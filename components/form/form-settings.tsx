"use client";

// «Настройка формы» — как в 1С: слева дерево элементов (части окна, таблицы и их столбцы) с флажками,
// стрелки ↑ ↓ переставляют столбцы, справа свойства выбранного (видимость, ширина столбца).
// Командная панель есть всегда — у неё галочка без флажка. Своё у каждого сотрудника и у каждого окна.
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Folder, Minus, PanelTop, PanelsTopLeft, Table2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FORM_PART_HINTS, FORM_PART_LABELS, HIDEABLE_PARTS, type ColumnLayout, type ColumnWidths, type FormPart } from "@/lib/form";
import type { TableInfo } from "@/components/form/columns";

export type FormSettingsResult = { hidden: FormPart[]; columns: ColumnLayout | null; widths: ColumnWidths | null };

type Selected = { kind: "part"; part: FormPart } | { kind: "table"; index: number } | { kind: "column"; key: string };

// Столбцы таблицы в нужном порядке: сначала из сохранённого порядка, потом остальные — как на странице.
function ordered(table: TableInfo, order: string[]) {
  const keys = table.columns.map((column) => column.key);
  const sorted = [...order.filter((key) => keys.includes(key)), ...keys.filter((key) => !order.includes(key))];
  return sorted.map((key) => table.columns.find((column) => column.key === key)!);
}

export default function FormSettingsDialog({
  open,
  onOpenChange,
  title,
  parts,
  hidden,
  tables,
  columns,
  widths,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  parts: FormPart[];
  hidden: FormPart[];
  tables: TableInfo[];
  columns: ColumnLayout | undefined;
  widths: ColumnWidths | undefined;
  onSave: (result: FormSettingsResult) => Promise<boolean>;
}) {
  const [draftParts, setDraftParts] = useState<FormPart[]>(hidden);
  const [order, setOrder] = useState<string[]>(columns?.order ?? []);
  const [hiddenCols, setHiddenCols] = useState<string[]>(columns?.hidden ?? []);
  const [draftWidths, setDraftWidths] = useState<ColumnWidths>(widths ?? {});
  const [selected, setSelected] = useState<Selected>({ kind: "part", part: parts[0] });
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  // Каждый раз окно открывается с сохранённой настройкой. Пока окно открыто, «Применить» его не сбрасывает.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setDraftParts(hidden);
      setOrder(columns?.order ?? []);
      setHiddenCols(columns?.hidden ?? []);
      setDraftWidths(widths ?? {});
      setSelected({ kind: "part", part: parts[0] });
      setMessage("");
    }
    wasOpen.current = open;
  }, [open, hidden, columns, widths, parts]);

  const changed = () => setMessage("");
  const partVisible = (part: FormPart) => !draftParts.includes(part);
  const togglePart = (part: FormPart) => {
    if (!HIDEABLE_PARTS.includes(part)) return;
    setDraftParts((now) => (now.includes(part) ? now.filter((p) => p !== part) : [...now, part]));
    changed();
  };
  const columnVisible = (key: string) => !hiddenCols.includes(key);
  const toggleColumn = (key: string) => {
    setHiddenCols((now) => (now.includes(key) ? now.filter((k) => k !== key) : [...now, key]));
    changed();
  };

  const tableOf = (key: string) => tables.find((table) => table.columns.some((column) => column.key === key));
  const columnOf = (key: string) => tableOf(key)?.columns.find((column) => column.key === key);

  // ↑ ↓: переставить выбранный столбец внутри его таблицы.
  const move = (step: -1 | 1) => {
    if (selected.kind !== "column") return;
    const table = tableOf(selected.key);
    if (!table) return;
    const keys = ordered(table, order).map((column) => column.key);
    const from = keys.indexOf(selected.key);
    const to = from + step;
    if (to < 0 || to >= keys.length) return;
    [keys[from], keys[to]] = [keys[to], keys[from]];
    setOrder([...tables.flatMap((other) => (other === table ? keys : ordered(other, order).map((column) => column.key)))]);
    changed();
  };

  const setWidth = (key: string, value: string) => {
    const width = Number(value);
    setDraftWidths((now) => {
      const next = { ...now };
      if (value.trim() === "" || !Number.isFinite(width) || width <= 0) delete next[key];
      else next[key] = Math.round(width);
      return next;
    });
    changed();
  };

  const result = (): FormSettingsResult => {
    // Порядок храним, только если он отличается от страницы.
    const moved = tables.some((table) => ordered(table, order).some((column, i) => column.key !== table.columns[i].key));
    const layout: ColumnLayout = { ...(moved ? { order } : {}), ...(hiddenCols.length ? { hidden: hiddenCols } : {}) };
    return {
      hidden: draftParts,
      columns: Object.keys(layout).length ? layout : null,
      widths: Object.keys(draftWidths).length ? draftWidths : null,
    };
  };

  const save = (close: boolean) =>
    startTransition(async () => {
      const ok = await onSave(result());
      if (!ok) setMessage("Не удалось сохранить");
      else if (close) onOpenChange(false);
      else setMessage("Применено");
    });

  const isSelected = (item: Selected) => JSON.stringify(item) === JSON.stringify(selected);
  const node = (item: Selected, depth: number, label: string, icon: React.ReactNode, check: React.ReactNode) => (
    <div
      key={JSON.stringify(item)}
      role="treeitem"
      aria-selected={isSelected(item)}
      tabIndex={0}
      className={cn("fs-node", isSelected(item) && "fs-node--selected")}
      style={{ paddingLeft: 8 + depth * 18 }}
      onClick={() => setSelected(item)}
      onKeyDown={(e) => {
        if (e.key === " ") {
          e.preventDefault();
          if (item.kind === "part") togglePart(item.part);
          if (item.kind === "column") toggleColumn(item.key);
        }
      }}
    >
      {check}
      <span className="fs-node-icon">{icon}</span>
      <span className="fs-node-label">{label}</span>
    </div>
  );
  const checkbox = (checked: boolean, onChange: () => void, label: string) => (
    <input type="checkbox" checked={checked} onChange={onChange} onClick={(e) => e.stopPropagation()} aria-label={label} />
  );

  const tree = parts.flatMap((part) => {
    const fixed = !HIDEABLE_PARTS.includes(part);
    const rows = [
      node(
        { kind: "part", part },
        1,
        FORM_PART_LABELS[part],
        part === "commands" ? <PanelTop size={14} /> : <Folder size={14} />,
        fixed ? <Check size={14} className="fs-fixed" aria-label="Есть всегда" /> : checkbox(partVisible(part), () => togglePart(part), `Показывать «${FORM_PART_LABELS[part]}»`)
      ),
    ];
    if (part === "pages") {
      for (const table of tables) {
        rows.push(node({ kind: "table", index: table.index }, 2, table.label, <Table2 size={14} />, <span className="fs-check-gap" />));
        for (const column of ordered(table, order)) {
          rows.push(
            node(
              { kind: "column", key: column.key },
              3,
              column.label,
              <Minus size={14} className="fs-col-icon" />,
              checkbox(columnVisible(column.key), () => toggleColumn(column.key), `Показывать столбец «${column.label}»`)
            )
          );
        }
      }
    }
    return rows;
  });

  const selectedColumn = selected.kind === "column" ? columnOf(selected.key) : undefined;
  const selectedTable = selected.kind === "table" ? tables.find((table) => table.index === selected.index) : undefined;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fs-overlay" />
        <Dialog.Content className="fs-dialog" aria-describedby={undefined}>
          <div className="fs-head">
            <Dialog.Title className="fs-title">Настройка формы</Dialog.Title>
            <Dialog.Close className="fs-x" aria-label="Закрыть">
              <X size={18} />
            </Dialog.Close>
          </div>

          <div className="fs-toolbar">
            <button type="button" className="fs-tool" disabled={selected.kind !== "column"} onClick={() => move(-1)} title="Переместить вверх">
              <ArrowUp size={15} />
            </button>
            <button type="button" className="fs-tool" disabled={selected.kind !== "column"} onClick={() => move(1)} title="Переместить вниз">
              <ArrowDown size={15} />
            </button>
          </div>

          <div className="fs-body">
            <div className="fs-col">
              <p className="fs-col-title">Элементы формы</p>
              <div className="fs-tree" role="tree" aria-label="Элементы формы">
                <div className="fs-node fs-node--root">
                  <PanelsTopLeft size={15} />
                  <span>Форма: {title}</span>
                </div>
                {tree}
              </div>
            </div>

            <div className="fs-col">
              <p className="fs-col-title">Свойства элемента формы</p>
              <div className="fs-props">
                {selected.kind === "part" && (
                  <>
                    <label className="fs-prop">
                      <span>Заголовок</span>
                      <input className="fs-input" value={FORM_PART_LABELS[selected.part]} readOnly />
                    </label>
                    <label className="fs-prop">
                      <span>Отображать</span>
                      <input
                        type="checkbox"
                        checked={partVisible(selected.part)}
                        disabled={!HIDEABLE_PARTS.includes(selected.part)}
                        onChange={() => togglePart(selected.part)}
                      />
                    </label>
                    <div className="fs-prop fs-prop--top">
                      <span>Подсказка</span>
                      <p className="fs-hint">{FORM_PART_HINTS[selected.part]}</p>
                    </div>
                  </>
                )}
                {selectedTable && (
                  <>
                    <label className="fs-prop">
                      <span>Заголовок</span>
                      <input className="fs-input" value={selectedTable.label} readOnly />
                    </label>
                    <div className="fs-prop fs-prop--top">
                      <span>Подсказка</span>
                      <p className="fs-hint">Таблица окна. Её столбцы ниже: флажок — показывать, стрелки ↑ ↓ — порядок, справа — ширина.</p>
                    </div>
                  </>
                )}
                {selectedColumn && (
                  <>
                    <label className="fs-prop">
                      <span>Заголовок</span>
                      <input className="fs-input" value={selectedColumn.label} readOnly />
                    </label>
                    <label className="fs-prop">
                      <span>Отображать</span>
                      <input type="checkbox" checked={columnVisible(selectedColumn.key)} onChange={() => toggleColumn(selectedColumn.key)} />
                    </label>
                    <label className="fs-prop">
                      <span>Ширина</span>
                      <input
                        className="fs-input fs-input--num"
                        type="number"
                        min={0}
                        step={10}
                        placeholder="авто"
                        value={draftWidths[selectedColumn.key] ?? ""}
                        onChange={(e) => setWidth(selectedColumn.key, e.target.value)}
                      />
                    </label>
                    <div className="fs-prop fs-prop--top">
                      <span>Подсказка</span>
                      <p className="fs-hint">
                        Ширина в пикселях, пусто — авто. Её же меняют, потянув мышью за правый край заголовка столбца.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="fs-foot">
            <button
              type="button"
              className="fs-btn fs-btn--left"
              disabled={pending}
              onClick={() => {
                setDraftParts([]);
                setOrder([]);
                setHiddenCols([]);
                setDraftWidths({});
                changed();
              }}
            >
              Стандартные
            </button>
            <span className="fs-message" role="status">
              {message}
            </span>
            <button type="button" className="fs-btn fs-btn--primary" disabled={pending} onClick={() => save(true)}>
              ОК
            </button>
            <Dialog.Close className="fs-btn" disabled={pending}>
              Отмена
            </Dialog.Close>
            <button type="button" className="fs-btn" disabled={pending} onClick={() => save(false)}>
              Применить
            </button>
          </div>

          <style>{`
            .fs-overlay { position: fixed; inset: 0; z-index: 60; background: rgba(31, 26, 20, 0.35); }
            .fs-dialog {
              position: fixed; z-index: 61; top: max(12px, 6dvh); left: 50%; transform: translateX(-50%);
              width: min(760px, calc(100vw - 24px)); max-height: calc(100dvh - 24px - max(12px, 6dvh)); overflow-y: auto;
              background: #fffcf6; border: 1px solid var(--color-border); border-radius: var(--radius-md);
              box-shadow: var(--shadow); padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;
            }
            .fs-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
            .fs-title { margin: 0; font-size: 17px; font-weight: 700; color: var(--color-text); }
            .fs-x {
              display: inline-flex; border: none; background: none; cursor: pointer; padding: 5px;
              border-radius: var(--radius-sm); color: var(--color-muted);
            }
            .fs-x:hover { color: var(--color-text); background: var(--color-muted-bg); }

            .fs-toolbar { display: flex; gap: 4px; }
            .fs-tool {
              display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 26px;
              border: 1px solid var(--color-border-strong); background: #fff; border-radius: 4px; color: #2a5d9f; cursor: pointer;
            }
            .fs-tool:hover:not(:disabled) { background: var(--color-muted-bg); }
            .fs-tool:disabled { color: var(--color-muted); opacity: 0.5; cursor: default; }

            .fs-body { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            .fs-col { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
            .fs-col-title { margin: 0; font-size: 12.5px; color: var(--color-muted); }
            .fs-tree, .fs-props {
              height: min(380px, 50dvh); overflow-y: auto; padding: 6px; background: #fff;
              border: 1px solid var(--color-border-strong); border-radius: 4px;
            }
            .fs-node {
              display: flex; align-items: center; gap: 6px; padding-top: 2px; padding-bottom: 2px; padding-right: 6px; border-radius: 3px;
              font-size: 13px; color: var(--color-text); cursor: pointer; outline: none; white-space: nowrap;
            }
            .fs-node--root { padding-left: 6px; cursor: default; font-weight: 600; }
            .fs-node:not(.fs-node--root):hover { background: var(--color-muted-bg); }
            .fs-node--selected, .fs-node--selected:hover { background: #fde7b8; }
            .fs-node:focus-visible { box-shadow: 0 0 0 2px var(--color-accent); }
            .fs-node input { margin: 0; accent-color: var(--color-accent); }
            .fs-node-icon { display: inline-flex; color: #b8860b; }
            .fs-node-label { overflow: hidden; text-overflow: ellipsis; }
            .fs-col-icon { color: #c0392b; }
            .fs-check-gap { display: inline-block; width: 13px; }
            .fs-fixed { color: var(--color-success); }

            .fs-props { display: flex; flex-direction: column; gap: 8px; padding: 10px; }
            .fs-prop { display: grid; grid-template-columns: 100px 1fr; align-items: center; gap: 8px; font-size: 13px; color: var(--color-text); }
            .fs-prop--top { align-items: start; }
            .fs-prop input[type="checkbox"] { justify-self: start; margin: 0; accent-color: var(--color-accent); }
            .fs-input {
              padding: 4px 8px; font: inherit; font-size: 13px; color: var(--color-text);
              background: var(--color-muted-bg); border: 1px solid var(--color-border-strong); border-radius: 3px;
            }
            .fs-input--num { width: 110px; background: #fff; }
            .fs-hint { margin: 0; font-size: 12.5px; color: var(--color-muted); line-height: 1.45; }

            .fs-foot { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 6px; }
            .fs-btn--left { margin-right: auto; }
            .fs-message { font-size: 12.5px; color: var(--color-success); margin-right: 6px; }
            .fs-btn {
              padding: 5px 14px; font: inherit; font-size: 13px; color: var(--color-text);
              background: #fff; border: 1px solid var(--color-border-strong); border-radius: 4px; cursor: pointer;
            }
            .fs-btn:hover { background: var(--color-muted-bg); }
            .fs-btn--primary { background: var(--color-accent); border-color: var(--color-accent); color: #fff; font-weight: 600; }
            .fs-btn--primary:hover { background: var(--color-accent-hover); }
            .fs-btn:disabled { opacity: 0.6; cursor: default; }

            @media (max-width: 560px) {
              .fs-body { grid-template-columns: 1fr; }
              .fs-tree, .fs-props { height: auto; max-height: 40dvh; }
            }
          `}</style>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
