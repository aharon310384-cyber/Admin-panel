import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Form from "@/components/form/form";
import { VersionDataView } from "@/components/history/version-report";
import { formatDateTime } from "@/lib/utils";
import { documentTitle, getVersion, isVersionEntity } from "@/lib/versions";

export const metadata: Metadata = { title: "Версия объекта" };

// Одна версия документа из «Истории изменений»: реквизиты и табличные части, как они были.
export default async function VersionPage({ params }: { params: Promise<{ entity: string; id: string; version: string }> }) {
  const { entity, id, version: raw } = await params;
  const version = Number(raw);
  if (!isVersionEntity(entity) || !Number.isInteger(version) || version < 1) notFound();
  const [name, details] = await Promise.all([documentTitle(entity, id), getVersion(entity, id, version)]);
  if (!name || !details) notFound();

  const base = `/history/${entity}/${id}`;
  const author = details.authorName ? ` (${details.authorName})` : "";

  return (
    <Form
      formKey="history-version"
      title={`${name} — версия № ${version} от ${formatDateTime(details.createdAt)}${author}`}
      commands={
        <>
          <Link href={base} className="cmd cmd--primary" data-command="history">
            История изменений
          </Link>
          {details.prev != null && (
            <Link href={`${base}/compare?a=${details.prev}&b=${version}`} className="cmd" data-command="compare-prev">
              Сравнить с предыдущей
            </Link>
          )}
        </>
      }
      header={
        <p className="vr-subline">
          {details.comment ? <>Комментарий: {details.comment}</> : "Без комментария"}
          {details.last && <> · текущая версия документа</>}
        </p>
      }
    >
      <VersionDataView data={details.data} />
      <style>{`.vr-subline { margin: 0; font-size: 13px; color: var(--color-text-secondary); }`}</style>
    </Form>
  );
}
