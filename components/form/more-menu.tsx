"use client";

// Кнопка «Ещё» справа на командной панели окна — полный список команд, как в 1С: сверху кнопки панели
// (в том числе не поместившиеся в строку), ниже стандартные. Команды без действия пока серые.
import * as Menu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { Fragment } from "react";
import {
  Calculator,
  CalendarDays,
  CalendarRange,
  CheckCheck,
  ChevronDown,
  ChartColumn,
  ChevronRight,
  CircleHelp,
  CopyPlus,
  FileCheck,
  FileMinus,
  FileX,
  Fingerprint,
  FolderOpen,
  History,
  ListTree,
  MessageSquare,
  Package,
  PanelsTopLeft,
  Pencil,
  RefreshCw,
  Save,
  Search,
  SearchX,
  Sheet,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { MORE_COMMANDS, MORE_COMMAND_IDS, type MoreCommandId } from "@/lib/form";
import type { ReportLink } from "@/lib/reports";

const STANDARD_IDS = new Set<string>(MORE_COMMAND_IDS);

const ICONS: Partial<Record<MoreCommandId, LucideIcon>> = {
  related: ListTree,
  copy: CopyPlus,
  edit: Pencil,
  delete: FileX,
  refresh: RefreshCw,
  period: CalendarRange,
  post: FileCheck,
  unpost: FileMinus,
  find: Search,
  cancelFind: SearchX,
  listSettings: SlidersHorizontal,
  chooseSettings: FolderOpen,
  saveSettings: Save,
  outputList: Sheet,
  onechat: MessageSquare,
  guid: Fingerprint,
  changeHistory: History,
  currencyCalc: Calculator,
  volumeCalc: Package,
  clearMismatch: CheckCheck,
  organizer: CalendarDays,
  editForm: PanelsTopLeft,
  help: CircleHelp,
};

// Кнопка командной панели, повторённая в «Ещё». icon — разметка значка с самой кнопки.
export type BarCommand = { id: string; label: string; shortcut?: string; icon: string; disabled: boolean };

export default function MoreMenu({
  bar,
  reports,
  enabled,
  onCommand,
}: {
  bar: BarCommand[];
  reports: ReportLink[];
  enabled: Set<string>;
  onCommand: (id: string) => void;
}) {
  const own = bar.filter((item) => !STANDARD_IDS.has(item.id));
  const top = own.length > 0 || reports.length > 0;
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger asChild>
        <button type="button" className="cmd form-more">
          Ещё
          <ChevronDown size={14} />
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className="more-menu" align="end" sideOffset={4} collisionPadding={8}>
          {own.map(({ id, label, shortcut, icon, disabled }) => (
            <Menu.Item key={id} className="more-item" disabled={disabled} onSelect={() => onCommand(id)}>
              <span className="more-icon" dangerouslySetInnerHTML={{ __html: icon }} />
              <span className="more-label">{label}</span>
              {shortcut && <span className="more-key">{shortcut}</span>}
            </Menu.Item>
          ))}
          {reports.length > 0 && (
            <Menu.Sub>
              <Menu.SubTrigger className="more-item">
                <span className="more-icon">
                  <ChartColumn size={15} />
                </span>
                <span className="more-label">Отчёты</span>
                <ChevronRight size={14} className="more-sub" />
              </Menu.SubTrigger>
              <Menu.Portal>
                <Menu.SubContent className="more-menu" sideOffset={2} collisionPadding={8}>
                  {reports.map(({ label, href }) => (
                    <Menu.Item key={href} asChild className="more-item">
                      <Link href={href}>
                        <span className="more-label">{label}</span>
                      </Link>
                    </Menu.Item>
                  ))}
                </Menu.SubContent>
              </Menu.Portal>
            </Menu.Sub>
          )}
          {MORE_COMMANDS.map((group, index) => (
            <Fragment key={group[0].id}>
              {(index > 0 || top) && <Menu.Separator className="more-sep" />}
              {group.map(({ id, label, shortcut, submenu }) => {
                const Icon = ICONS[id];
                const on = enabled.has(id);
                return (
                  <Menu.Item
                    key={id}
                    className="more-item"
                    disabled={!on}
                    title={on ? undefined : "Скоро"}
                    onSelect={() => onCommand(id)}
                  >
                    <span className="more-icon">{Icon && <Icon size={15} />}</span>
                    <span className="more-label">{label}</span>
                    {shortcut && <span className="more-key">{shortcut}</span>}
                    {submenu && <ChevronRight size={14} className="more-sub" />}
                  </Menu.Item>
                );
              })}
            </Fragment>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
