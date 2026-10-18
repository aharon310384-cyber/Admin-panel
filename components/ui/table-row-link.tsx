"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
  href: string;
  className?: string;
  children: ReactNode;
  doc?: { entity: string; id: string }; // документ строки: окно делает её текущей по щелчку
};

export default function TableRowLink({ href, className, children, doc }: Props) {
  const router = useRouter();
  const classes = ["row-clickable", className].filter(Boolean).join(" ");

  return (
    <tr
      className={classes}
      data-doc={doc?.entity}
      data-doc-id={doc?.id}
      title="Двойной клик — открыть"
      onDoubleClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("button, a, input, label, select, textarea")) return;
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
