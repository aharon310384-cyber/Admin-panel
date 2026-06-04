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
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

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
