import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HistoryWindow, { type HistoryRow } from "@/components/history/history-window";
import { formatDateTime } from "@/lib/utils";
import { documentTitle, isVersionEntity, listVersions } from "@/lib/versions";

export const metadata: Metadata = { title: "История изменений" };

// «История изменений» заказа или посылки — как версионирование объектов в 1С (lib/versions.ts).
export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ entity: string; id: string }>;
  searchParams: Promise<{ field?: string }>;
}) {
  const { entity, id } = await params;
  if (!isVersionEntity(entity)) notFound();
  const name = await documentTitle(entity, id);
  if (!name) notFound();

  const versions = await listVersions(entity, id);
  const latest = versions[0]?.data;
  // Варианты отбора — реквизиты и табличные части текущей версии
  const fieldOptions = latest
    ? [
        ...latest.fields.map((f) => ({ key: f.key, label: f.label })),
        ...latest.tables.map((t) => ({ key: t.key, label: `Табличная часть «${t.label}»` })),
      ]
    : [];
  const { field: rawField = "" } = await searchParams;
  const option = fieldOptions.find((o) => o.key === rawField);
  const field = option ? option.key : "";

  const rows: HistoryRow[] = versions
    .filter((v) => !field || v.changed.includes(field))
    .map((v) => ({
      version: v.version,
      prev: v.prev,
      author: v.authorName ?? "—",
      date: formatDateTime(v.createdAt),
      comment: v.comment ?? "",
    }));

  const emptyText =
    versions.length === 0
      ? "Изменений пока не было: история появится после первого изменения документа"
      : `Нет версий, в которых менялся реквизит «${option?.label ?? ""}»`;

  return (
    <HistoryWindow
      key={field}
      base={`/history/${entity}/${id}`}
      title={`История изменений: ${name}`}
      rows={rows}
      total={versions.length}
      lastVersion={versions[0]?.version ?? null}
      field={field}
      fieldOptions={fieldOptions}
      emptyText={emptyText}
    />
  );
}
