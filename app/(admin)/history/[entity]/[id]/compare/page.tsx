import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Form from "@/components/form/form";
import { CompareReport } from "@/components/history/version-report";
import { compareVersions, documentTitle, isVersionEntity } from "@/lib/versions";

export const metadata: Metadata = { title: "Сравнение версий" };

// Сравнение двух версий документа (?a=1&b=2) — «Отчёт по изменениям версий объекта», как в 1С:
// новая версия слева, строки с различиями — голубым фоном.
export default async function CompareVersionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ entity: string; id: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { entity, id } = await params;
  const query = await searchParams;
  const a = Number(query.a);
  const b = Number(query.b);
  if (!isVersionEntity(entity) || !Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < 1) notFound();
  const newer = Math.max(a, b);
  const older = Math.min(a, b);

  const [name, comparison] = await Promise.all([documentTitle(entity, id), compareVersions(entity, id, newer, older)]);
  if (!name || !comparison) notFound();

  const base = `/history/${entity}/${id}`;
  const changed = comparison.fields.filter((f) => f.changed).length + comparison.tables.filter((t) => t.changed).length;

  return (
    <Form
      formKey="history-compare"
      title={`Сравнение версий "${name}" (№№ ${older}, ${newer})`}
      commands={
        <>
          <Link href={base} className="cmd cmd--primary" data-command="history">
            История изменений
          </Link>
          <Link href={`${base}/${newer}`} className="cmd" data-command="open-newer">
            Открыть версию № {newer}
          </Link>
          <Link href={`${base}/${older}`} className="cmd" data-command="open-older">
            Открыть версию № {older}
          </Link>
        </>
      }
      footer={changed ? <>Различий: {changed}</> : <>Версии не различаются</>}
    >
      <CompareReport objectName={name} comparison={comparison} />
    </Form>
  );
}
