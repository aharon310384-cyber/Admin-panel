"use client";

import { useRouter } from "next/navigation";
import type { ReactNode, MouseEvent } from "react";

/**
 * Строка таблицы целиком кликабельна: курсор-палец, переход по двойному клику.
 * Клик по вложенным интерактивным элементам (ссылки/кнопки) не перехватываем.
 * doc — документ строки: окно делает её текущей по щелчку (components/form/form.tsx).
 */
export default function ClickableRow({
  href,
  children,
  className,
  doc,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  doc?: { entity: string; id: string };
}) {
  const router = useRouter();

  const onDoubleClick = (e: MouseEvent<HTMLTableRowElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, select, label")) return;
    router.push(href);
  };

  return (
    <tr
      className={className}
      data-doc={doc?.entity}
      data-doc-id={doc?.id}
      onDoubleClick={onDoubleClick}
      title="Двойной клик — открыть"
      style={{ cursor: "pointer" }}
    >
      {children}
    </tr>
  );
}
