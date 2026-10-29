import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

type SortDirection = "asc" | "desc";

type SortableHeaderProps = {
  active: boolean;
  direction: SortDirection;
  href: string;
  label: string;
  align?: "left" | "right";
};

export default function SortableHeader({
  active,
  direction,
  href,
  label,
  align = "left",
}: SortableHeaderProps) {
  // Стрелка — как в 1С: показывает, где значения больше. ↓ — по возрастанию (старые даты сверху), ↑ — по убыванию.
  const Icon = active ? (direction === "asc" ? ArrowDown : ArrowUp) : ArrowUpDown;

  return (
    <Link
      href={href}
      className={`sort-link ${active ? "sort-link--active" : ""} ${
        align === "right" ? "sort-link--right" : ""
      }`}
    >
      <span>{label}</span>
      <Icon size={13} className="sort-link-icon" aria-hidden="true" />
    </Link>
  );
}
