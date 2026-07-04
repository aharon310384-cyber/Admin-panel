"use client";

import { useRouter } from "next/navigation";
import type { ReactNode, MouseEvent } from "react";

/**
 * Строка таблицы целиком кликабельна: курсор-палец, переход по двойному клику.
 * Клик по вложенным интерактивным элементам (ссылки/кнопки) не перехватываем.
 */
export default function ClickableRow({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
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
      onDoubleClick={onDoubleClick}
      title="Двойной клик — открыть"
      style={{ cursor: "pointer" }}
    >
      {children}
    </tr>
  );
}
