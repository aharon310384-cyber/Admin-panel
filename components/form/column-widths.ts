// Ширина столбцов таблиц окна — как в 1С: потянуть мышью за правый край заголовка столбца.
// Ширины своих у каждого сотрудника и окна (FormSettings.widths); ключ столбца — «номер таблицы:заголовок».
// Таблица с заданными ширинами переходит на table-layout: fixed, длинный текст в ячейке обрезается.
import { COLUMN_MAX, COLUMN_MIN, type ColumnWidths } from "@/lib/form";

const EDGE = 6; // сколько пикселей у правого края заголовка ловят мышь

function tablesOf(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLTableElement>(".form-pages table")].filter((table) => table.tHead);
}

function headCells(table: HTMLTableElement) {
  const row = table.tHead?.rows[table.tHead.rows.length - 1];
  return row ? [...row.cells] : [];
}

function columnKey(tableIndex: number, cell: HTMLTableCellElement, index: number) {
  const label = cell.textContent?.trim() || cell.getAttribute("aria-label") || `#${index + 1}`;
  return `${tableIndex}:${label}`.slice(0, 80);
}

// Зафиксировать ширины: сохранённые — как есть, остальные — как сейчас на экране.
function fix(table: HTMLTableElement, tableIndex: number, widths: ColumnWidths) {
  const cells = headCells(table);
  const sizes = cells.map((cell, i) => widths[columnKey(tableIndex, cell, i)] ?? Math.round(cell.getBoundingClientRect().width));
  cells.forEach((cell, i) => (cell.style.width = `${sizes[i]}px`));
  table.style.tableLayout = "fixed";
  table.style.minWidth = "0";
  table.style.width = `${sizes.reduce((sum, size) => sum + size, 0)}px`;
  table.dataset.resized = "";
}

// Применить сохранённые ширины к таблицам окна, которые ещё не зафиксированы.
export function applyWidths(root: HTMLElement, widths: ColumnWidths | undefined) {
  if (!widths) return;
  tablesOf(root).forEach((table, tableIndex) => {
    if (table.dataset.resized !== undefined) return;
    const known = headCells(table).some((cell, i) => widths[columnKey(tableIndex, cell, i)] !== undefined);
    if (known) fix(table, tableIndex, widths);
  });
}

// «Установить стандартные настройки»: вернуть таблицам их обычную ширину.
export function clearWidths(root: HTMLElement) {
  for (const table of tablesOf(root)) {
    if (table.dataset.resized === undefined) continue;
    headCells(table).forEach((cell) => (cell.style.width = ""));
    table.style.tableLayout = table.style.minWidth = table.style.width = "";
    delete table.dataset.resized;
  }
}

// Перетаскивание края заголовка. onDone получает ширины всех столбцов этой таблицы после перетаскивания.
export function attachResize(root: HTMLElement, getWidths: () => ColumnWidths, onDone: (widths: ColumnWidths) => void) {
  const edgeCell = (event: PointerEvent) => {
    const cell = (event.target as HTMLElement | null)?.closest<HTMLTableCellElement>("thead th");
    if (!cell || !root.contains(cell) || !cell.closest(".form-pages")) return null;
    const rect = cell.getBoundingClientRect();
    return rect.right - event.clientX <= EDGE ? cell : null;
  };

  let drag: { cell: HTMLTableCellElement; table: HTMLTableElement; startX: number; startWidth: number } | null = null;
  let swallowClick = false;

  const onMove = (event: PointerEvent) => {
    if (drag) {
      const width = Math.min(COLUMN_MAX, Math.max(COLUMN_MIN, drag.startWidth + event.clientX - drag.startX));
      drag.cell.style.width = `${width}px`;
      drag.table.style.width = `${headCells(drag.table).reduce((sum, cell) => sum + parseFloat(cell.style.width || "0"), 0)}px`;
      return;
    }
    const cell = (event.target as HTMLElement | null)?.closest<HTMLTableCellElement>("thead th");
    if (cell && root.contains(cell)) cell.style.cursor = edgeCell(event) ? "col-resize" : "";
  };

  const onDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const cell = edgeCell(event);
    if (!cell) return;
    const table = cell.closest("table") as HTMLTableElement;
    const tableIndex = tablesOf(root).indexOf(table);
    if (tableIndex < 0) return;
    event.preventDefault();
    if (table.dataset.resized === undefined) fix(table, tableIndex, getWidths());
    drag = { cell, table, startX: event.clientX, startWidth: parseFloat(cell.style.width) };
    swallowClick = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const onUp = () => {
    if (!drag) return;
    const { table } = drag;
    drag = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    const tableIndex = tablesOf(root).indexOf(table);
    const widths: ColumnWidths = {};
    headCells(table).forEach((cell, i) => (widths[columnKey(tableIndex, cell, i)] = Math.round(parseFloat(cell.style.width))));
    onDone(widths);
  };

  // Клик после перетаскивания не должен сортировать столбец (заголовки — ссылки сортировки).
  const onClick = (event: MouseEvent) => {
    if (!swallowClick) return;
    swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  };
  const onDownReset = () => {
    if (!drag) swallowClick = false;
  };

  root.addEventListener("pointerdown", onDownReset, true);
  root.addEventListener("pointerdown", onDown);
  root.addEventListener("click", onClick, true);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  return () => {
    root.removeEventListener("pointerdown", onDownReset, true);
    root.removeEventListener("pointerdown", onDown);
    root.removeEventListener("click", onClick, true);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };
}
