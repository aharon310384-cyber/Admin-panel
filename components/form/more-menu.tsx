"use client";

// Кнопка «Ещё» справа на командной панели окна — полный список команд, как в 1С: сверху кнопки панели
// (в том числе не поместившиеся в строку), ниже стандартные. Команды без действия пока серые.
// Команды поиска собраны в подменю «Управление поиском», с недавними поисками окна внизу.
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Fragment } from "react";
import {
  Calculator,
  CalendarDays,
  CalendarRange,
  CheckCheck,
  ChevronDown,
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
  TextSearch,
  type LucideIcon,
} from "lucide-react";
import { MORE_COMMANDS, MORE_COMMAND_IDS, SEARCH_COMMANDS_LABEL, type MoreCommand, type MoreCommandId } from "@/lib/form";

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
  findValue: TextSearch,
  find: Search,
  advancedFind: Search,
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
// Недавний поиск окна — пункт подменю «Управление поиском».
export type RecentSearch = { label: string; onSelect: () => void };

const isSearchGroup = (group: MoreCommand[]) => group.some(({ id }) => id === "find");

export default function MoreMenu({
  bar,
  enabled,
  onCommand,
  recentSearches = [],
}: {
  bar: BarCommand[];
  enabled: Set<string>;
  onCommand: (id: string) => void;
  recentSearches?: RecentSearch[];
}) {
  const own = bar.filter((item) => !STANDARD_IDS.has(item.id));
  const item = ({ id, label, shortcut, submenu }: MoreCommand) => {
    const Icon = ICONS[id];
    const on = enabled.has(id);
    return (
      <Menu.Item key={id} className="more-item" disabled={!on} title={on ? undefined : "Скоро"} onSelect={() => onCommand(id)}>
        <span className="more-icon">{Icon && <Icon size={15} />}</span>
        <span className="more-label">{label}</span>
        {shortcut && <span className="more-key">{shortcut}</span>}
        {submenu && <ChevronRight size={14} className="more-sub" />}
      </Menu.Item>
    );
  };
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
          {MORE_COMMANDS.map((group, index) => (
            <Fragment key={group[0].id}>
              {(index > 0 || own.length > 0) && <Menu.Separator className="more-sep" />}
              {isSearchGroup(group) ? (
                <Menu.Sub>
                  <Menu.SubTrigger className="more-item" disabled={!group.some(({ id }) => enabled.has(id))}>
                    <span className="more-icon"><Search size={15} /></span>
                    <span className="more-label">{SEARCH_COMMANDS_LABEL}</span>
                    <ChevronRight size={14} className="more-sub" />
                  </Menu.SubTrigger>
                  <Menu.Portal>
                    <Menu.SubContent className="more-menu" sideOffset={2} collisionPadding={8}>
                      {group.map(item)}
                      {recentSearches.length > 0 && <Menu.Separator className="more-sep" />}
                      {recentSearches.map(({ label, onSelect }) => (
                        <Menu.Item key={label} className="more-item" onSelect={onSelect}>
                          <span className="more-icon" />
                          <span className="more-label">{label}</span>
                        </Menu.Item>
                      ))}
                    </Menu.SubContent>
                  </Menu.Portal>
                </Menu.Sub>
              ) : (
                group.map(item)
              )}
            </Fragment>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
