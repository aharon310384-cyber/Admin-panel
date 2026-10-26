// Поиск в списках, как в 1С: строка «Поиск (Ctrl+F)» — по всем полям списка, «Расширенный поиск» (Alt+F) — по одному полю
// с условием «любая часть / начало строки / точное совпадение». Держится в адресе окна: q — поиск по всем полям;
// sf, sv, sm — поле, значение и условие расширенного поиска. Общий модуль для сервера и браузера.

export type SearchMode = "any" | "start" | "exact";

export const SEARCH_MODES: [SearchMode, string][] = [
  ["any", "любая часть"],
  ["start", "начало строки"],
  ["exact", "точное совпадение"],
];

/** Поле поиска списка; label — как заголовок колонки (по нему «Найти по текущему значению» узнаёт поле). */
export type ListSearchField = { key: string; label: string };

export type ListSearch = { q: string; field: string | null; value: string; mode: SearchMode };

const clean = (value: string | null | undefined) => (value ?? "").trim().slice(0, 100);

export function readListSearch(params: Record<string, string | string[] | undefined>): ListSearch {
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const mode = one("sm");
  return {
    q: clean(one("q")),
    field: clean(one("sf")) || null,
    value: clean(one("sv")),
    mode: mode === "start" || mode === "exact" ? mode : "any",
  };
}

/** Поиск обратно в параметры адреса — чтобы ссылки сортировки и отборов его не теряли. */
export function searchParamsOf(search: ListSearch): Record<string, string | undefined> {
  const extended = search.field && search.value;
  return {
    q: search.q || undefined,
    sf: extended ? search.field! : undefined,
    sv: extended ? search.value : undefined,
    sm: extended && search.mode !== "any" ? search.mode : undefined,
  };
}

/** Условие по строке без учёта регистра (Prisma, PostgreSQL). */
export function textFilter(value: string, mode: SearchMode) {
  const insensitive = "insensitive" as const;
  if (mode === "exact") return { equals: value, mode: insensitive };
  if (mode === "start") return { startsWith: value, mode: insensitive };
  return { contains: value, mode: insensitive };
}

type TextFilter = ReturnType<typeof textFilter>;
/** Поле поиска на сервере: как условие по строке превращается в отбор Prisma. */
export type ServerSearchField<W> = ListSearchField & { where: (filter: TextFilter) => W };

/** Условия отбора: поиск по всем полям (любая часть) и расширенный поиск по одному полю. */
export function searchConditions<W>(search: ListSearch, fields: ServerSearchField<W>[]): W[] {
  const conditions: W[] = [];
  if (search.q) conditions.push({ OR: fields.map((f) => f.where(textFilter(search.q, "any"))) } as W);
  const field = search.field ? fields.find((f) => f.key === search.field) : undefined;
  if (field && search.value) conditions.push(field.where(textFilter(search.value, search.mode)));
  return conditions;
}

/** Поля для браузера (без условий Prisma). */
export const clientFields = (fields: ListSearchField[]): ListSearchField[] => fields.map(({ key, label }) => ({ key, label }));
