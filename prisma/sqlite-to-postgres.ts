// Перенос данных из SQLite в PostgreSQL. Один раз, при переходе рабочей базы на PostgreSQL:
//   SQLITE_URL="file:/opt/postmanfox/data/postmanfox.db" npm run db:copy-from-sqlite
//
// Источник — SQLite по SQLITE_URL, только чтение. Приёмник — PostgreSQL по DATABASE_URL:
// таблицы уже созданы `prisma db push` и пустые.
// Клиент Prisma для SQLite собирается из копии schema.prisma (provider = "sqlite") в node_modules/.prisma-sqlite,
// основной клиент приложения не трогается.
// Все строки копируются и сверяются с источником в одной транзакции: при любом расхождении в PostgreSQL ничего не остаётся.
// В журнал выводятся только количества и названия таблиц: журнал задачи «Сервер» в GitHub публичный.
// Полный текст ошибки (в нём могут быть данные клиентов) — в node_modules/.prisma-sqlite/error.log.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";

type Row = Record<string, unknown>;
type Delegate = {
  findMany(args?: object): Promise<Row[]>;
  count(): Promise<number>;
  createMany(args: { data: Row[] }): Promise<unknown>;
  update(args: { where: Row; data: Row }): Promise<unknown>;
};
type Fk = { field: string; target: string; required: boolean };

const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "node_modules", ".prisma-sqlite");
const CHUNK = 500;

// Ошибка с безопасным для публичного журнала текстом.
class CopyError extends Error {}
let stage = "подготовка";

function replaceOnce(text: string, pattern: RegExp, replacement: string) {
  if ((text.match(new RegExp(pattern, "g")) ?? []).length !== 1) {
    throw new CopyError(`В schema.prisma не найдено ровно одно совпадение ${pattern}`);
  }
  return text.replace(pattern, replacement);
}

// Клиент Prisma для чтения SQLite: та же схема, другой провайдер, отдельный каталог.
function sqliteClient(): PrismaClient {
  const dir = DIR;
  let schema = readFileSync(path.join(ROOT, "prisma", "schema.prisma"), "utf8");
  schema = replaceOnce(schema, /provider\s*=\s*"postgresql"/, 'provider = "sqlite"');
  schema = replaceOnce(schema, /url\s*=\s*env\("DATABASE_URL"\)/, 'url = env("SQLITE_URL")');
  schema = replaceOnce(schema, /provider\s*=\s*"prisma-client-js"/, 'provider = "prisma-client-js"\n  output = "./client"');
  writeFileSync(path.join(dir, "schema.prisma"), schema);
  execFileSync(path.join(ROOT, "node_modules", ".bin", "prisma"), ["generate", "--schema", path.join(dir, "schema.prisma")], {
    cwd: ROOT,
    stdio: ["ignore", "ignore", "inherit"],
  });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const generated = require(path.join(dir, "client")) as { PrismaClient: typeof PrismaClient };
  return new generated.PrismaClient();
}

function delegate(client: unknown, model: string) {
  return (client as Record<string, Delegate>)[model[0].toLowerCase() + model.slice(1)];
}

function foreignKeys(model: Prisma.DMMF.Model): Fk[] {
  return model.fields
    .filter((field) => field.kind === "object" && field.relationFromFields?.length)
    .flatMap((field) => field.relationFromFields!.map((name) => ({ field: name, target: field.type, required: field.isRequired })));
}

function idFields(model: Prisma.DMMF.Model) {
  const single = model.fields.filter((field) => field.isId).map((field) => field.name);
  const ids = single.length ? single : (model.primaryKey?.fields ?? []);
  if (!ids.length) throw new CopyError(`У таблицы ${model.name} нет первичного ключа`);
  return ids;
}

function idWhere(model: Prisma.DMMF.Model, row: Row): Row {
  const ids = idFields(model);
  if (ids.length === 1) return { [ids[0]]: row[ids[0]] };
  return { [ids.join("_")]: Object.fromEntries(ids.map((id) => [id, row[id]])) };
}

// Порядок таблиц: сначала те, на которые ссылаются. Необязательные ссылки вперёд и на себя
// вставляются пустыми и заполняются после всех таблиц.
function copyOrder(models: readonly Prisma.DMMF.Model[]) {
  const done = new Set<string>();
  const order: Prisma.DMMF.Model[] = [];
  const ready = (model: Prisma.DMMF.Model, allowOptional: boolean) =>
    !done.has(model.name) &&
    foreignKeys(model).every((fk) => fk.target === model.name || done.has(fk.target) || (allowOptional && !fk.required));
  while (order.length < models.length) {
    const next = models.find((model) => ready(model, false)) ?? models.find((model) => ready(model, true));
    if (!next) throw new CopyError("Не удалось упорядочить таблицы по связям");
    done.add(next.name);
    order.push(next);
  }
  return order;
}

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Prisma.Decimal.isDecimal(value)) return new Prisma.Decimal(value as Prisma.Decimal.Value).toString();
  if (typeof value === "bigint") return value.toString();
  return value;
}

function rowKey(row: Row) {
  return JSON.stringify(
    Object.keys(row)
      .sort()
      .map((key) => [key, normalize(row[key])]),
  );
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  if (!process.env.SQLITE_URL?.startsWith("file:")) {
    throw new CopyError('Задайте SQLITE_URL — путь к базе SQLite, например file:/opt/postmanfox/data/postmanfox.db');
  }
  const models = copyOrder(Prisma.dmmf.datamodel.models);
  const pg = new PrismaClient();
  const sqlite = sqliteClient();

  try {
    for (const model of models) {
      stage = `проверка, что PostgreSQL пустая: ${model.name}`;
      if ((await delegate(pg, model.name).count()) > 0) {
        throw new CopyError(`В PostgreSQL таблица ${model.name} не пустая — перенос делается только в пустую базу`);
      }
    }

    const source = new Map<string, Row[]>();
    for (const model of models) {
      stage = `чтение SQLite: ${model.name}`;
      source.set(model.name, await delegate(sqlite, model.name).findMany());
    }

    // PostgreSQL не принимает в тексте нулевой символ (\u0000), SQLite принимает. Находим заранее,
    // чтобы в журнале было видно, где он, а не только «ошибка записи».
    stage = "проверка текста";
    const withNul: string[] = [];
    for (const model of models) {
      for (const field of model.fields.filter((item) => item.kind === "scalar" && item.type === "String")) {
        const count = source.get(model.name)!.filter((row) => typeof row[field.name] === "string" && (row[field.name] as string).includes("\u0000")).length;
        if (count) withNul.push(`${model.name}.${field.name} — строк: ${count}`);
      }
    }
    if (withNul.length) throw new CopyError(`В SQLite есть текст с нулевым символом, PostgreSQL его не примет: ${withNul.join("; ")}`);

    // Запись и сверка в одной транзакции: если сверка не прошла, в PostgreSQL не остаётся ничего.
    const total = await pg.$transaction(
      async (tx) => {
        const inserted = new Set<string>();
        const later: { model: Prisma.DMMF.Model; fields: string[] }[] = [];
        for (const model of models) {
          const deferred = foreignKeys(model)
            .filter((fk) => fk.target === model.name || !inserted.has(fk.target))
            .map((fk) => fk.field);
          stage = `запись в PostgreSQL: ${model.name}`;
          const empty = Object.fromEntries(deferred.map((field) => [field, null]));
          const rows = source.get(model.name)!;
          for (let index = 0; index < rows.length; index += CHUNK) {
            await delegate(tx, model.name).createMany({ data: rows.slice(index, index + CHUNK).map((row) => ({ ...row, ...empty })) });
          }
          inserted.add(model.name);
          if (deferred.length) later.push({ model, fields: deferred });
        }
        for (const { model, fields } of later) {
          stage = `запись ссылок: ${model.name}`;
          // @updatedAt передаём явно, иначе Prisma поставит в нём текущее время.
          const updatedAt = model.fields.filter((field) => field.isUpdatedAt).map((field) => field.name);
          for (const row of source.get(model.name)!) {
            const links = fields.filter((field) => row[field] != null);
            if (!links.length) continue;
            const data = Object.fromEntries([...links, ...updatedAt].map((field) => [field, row[field]]));
            await delegate(tx, model.name).update({ where: idWhere(model, row), data });
          }
        }

        let count = 0;
        const mismatched: string[] = [];
        for (const model of models) {
          stage = `сверка: ${model.name}`;
          const expected = source.get(model.name)!.map(rowKey).sort();
          const actual = (await delegate(tx, model.name).findMany()).map(rowKey).sort();
          count += expected.length;
          if (expected.length !== actual.length || expected.some((key, index) => key !== actual[index])) {
            mismatched.push(`${model.name} (в SQLite ${expected.length}, в PostgreSQL ${actual.length})`);
          }
        }
        stage = "сверка";
        if (mismatched.length) throw new CopyError(`Сверка не прошла, таблицы отличаются: ${mismatched.join(", ")}`);
        return count;
      },
      { maxWait: 60_000, timeout: 30 * 60_000 },
    );

    console.log(`Перенесено таблиц: ${models.length}, строк: ${total}. Сверка: каждая строка совпадает с SQLite.`);
  } finally {
    await Promise.all([pg.$disconnect(), sqlite.$disconnect()]);
  }
}

main().catch((error) => {
  writeFileSync(path.join(DIR, "error.log"), `${stage}\n${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`, { mode: 0o600 });
  // В meta бывают названия таблиц и полей — их показать можно, значения — нет.
  const meta = error instanceof Prisma.PrismaClientKnownRequestError ? (error.meta ?? {}) : {};
  const where = ["modelName", "field_name", "target", "column"].flatMap((key) => (meta[key] ? [`${key}: ${String(meta[key])}`] : []));
  const code = error instanceof Prisma.PrismaClientKnownRequestError ? `, код Prisma ${error.code}${where.length ? ` (${where.join(", ")})` : ""}` : "";
  const reason = error instanceof CopyError ? error.message : `${error instanceof Error ? error.constructor.name : "ошибка"}${code}`;
  console.error(`Перенос не выполнен (${stage}): ${reason}. Полный текст: node_modules/.prisma-sqlite/error.log`);
  process.exit(1);
});
