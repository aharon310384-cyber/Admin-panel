import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Form from "@/components/form/form";
import RelatedTree from "@/components/related/related-tree";
import { relatedTree, type RelatedDoc } from "@/lib/related-documents";

export const metadata: Metadata = { title: "Связанные документы" };

const DOCS: RelatedDoc[] = ["order", "parcel"];

export default async function RelatedDocumentsPage({ params }: { params: Promise<{ doc: string; id: string }> }) {
  const { doc, id } = await params;
  if (!DOCS.includes(doc as RelatedDoc)) notFound();
  const tree = await relatedTree(doc as RelatedDoc, id);
  if (!tree) notFound();

  return (
    <Form formKey="related-documents" title={`Связанные документы: ${tree.title}`}>
      <div className="card">
        <RelatedTree roots={tree.roots} />
      </div>
    </Form>
  );
}
