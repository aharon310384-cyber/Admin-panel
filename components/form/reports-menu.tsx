"use client";

// Кнопка «Отчёты» на командной панели окна — как в 1С. Какие отчёты у окна — lib/reports.ts.
import * as Menu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { ChartColumn, ChevronDown } from "lucide-react";
import type { ReportLink } from "@/lib/reports";

export default function ReportsMenu({ reports }: { reports: ReportLink[] }) {
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger asChild>
        <button type="button" className="cmd form-reports">
          <ChartColumn size={15} />
          Отчёты
          <ChevronDown size={14} />
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className="more-menu" align="start" sideOffset={4} collisionPadding={8}>
          {reports.map(({ label, href }) => (
            <Menu.Item key={href} asChild className="more-item">
              <Link href={href}>
                <span className="more-label">{label}</span>
              </Link>
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
