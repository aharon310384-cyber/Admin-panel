// Дерево «Связанных документов» — как в 1С: «Вид Номер от дата», отступы с пунктирными линиями,
// документ, из которого открыли, — жирным, помеченные на удаление — зачёркнутыми.
import Link from "next/link";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { relatedLine, type RelatedNode } from "@/lib/related-documents";

function Branch({ nodes }: { nodes: RelatedNode[] }) {
  return (
    <ul>
      {nodes.map((node) => (
        <li key={node.key}>
          <div className={cn("rel-row", node.current && "rel-row--current", node.deleted && "rel-row--deleted")}>
            <FileText size={14} className="rel-icon" />
            {node.href && !node.current ? (
              <Link href={node.href} className="rel-link">
                {relatedLine(node)}
              </Link>
            ) : (
              <span>{relatedLine(node)}</span>
            )}
            {node.note && <span className="rel-note">{node.note}</span>}
          </div>
          {node.children.length > 0 && <Branch nodes={node.children} />}
        </li>
      ))}
    </ul>
  );
}

export default function RelatedTree({ roots }: { roots: RelatedNode[] }) {
  return (
    <div className="rel-tree">
      <Branch nodes={roots} />
      <style>{`
        .rel-tree { padding: 8px 10px; font-size: 13px; overflow-x: auto; }
        .rel-tree ul { list-style: none; margin: 0; padding: 0; }
        .rel-tree ul ul { margin-left: 7px; padding-left: 14px; border-left: 1px dotted var(--color-border-strong); }
        .rel-tree li { position: relative; }
        .rel-tree ul ul > li > .rel-row::before {
          content: ""; position: absolute; left: -14px; top: 12px; width: 11px; border-top: 1px dotted var(--color-border-strong);
        }
        .rel-row { position: relative; display: flex; align-items: center; gap: 6px; width: fit-content; padding: 2px 6px; border-radius: 3px; white-space: nowrap; }
        .rel-row--current { font-weight: 700; background: #fde7b8; }
        .rel-row--deleted { color: var(--color-muted); text-decoration: line-through; }
        .rel-icon { flex-shrink: 0; color: var(--color-success); }
        .rel-link { color: #2a5d9f; text-decoration: none; }
        .rel-link:hover { text-decoration: underline; }
        .rel-note { font-weight: 400; font-size: 12px; color: var(--color-muted); }
      `}</style>
    </div>
  );
}
