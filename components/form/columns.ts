// Столбцы таблиц окна — как в «Настройке формы» 1С: какие видны и в каком порядке.
// Ключ столбца — «номер таблицы:заголовок» (те же ключи у ширины, components/form/column-widths.ts).
// Ячейки помечаются data-col при первом показе строки, в исходном порядке; дальше их можно переставлять и прятать.
import type { ColumnLayout } from "@/lib/form";

export type TableInfo = { index: number; label: string; columns: { key: string; label: string }[] };

export function tablesOf(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLTableElement>(".form-pages table")].filter((table) => table.tHead);
}

export function headCells(table: HTMLTableElement) {
  const row = table.tHead?.rows[table.tHead.rows.length - 1];
  return row ? [...row.cells] : [];
}

function cellLabel(cell: HTMLTableCellElement) {
  return cell.textContent?.trim() || cell.getAttribute("aria-label") || "";
}

// Ключ столбца: из пометки data-col, а до пометки — по заголовку (пустой — по номеру столбца).
export function columnKey(tableIndex: number, cell: HTMLTableCellElement, index: number) {
  return cell.dataset.col ?? `${tableIndex}:${cellLabel(cell) || `#${index + 1}`}`.slice(0, 80);
}

// Исходные ключи столбцов таблицы (в порядке страницы); пометить заголовок и строки, которые ещё не помечены.
function tag(table: HTMLTableElement, tableIndex: number): string[] {
  let keys: string[];
  if (table.dataset.cols) {
    keys = JSON.parse(table.dataset.cols);
  } else {
    const seen = new Set<string>();
    keys = headCells(table).map((cell, i) => {
      let key = columnKey(tableIndex, cell, i);
      while (seen.has(key)) key = `${key}~`;
      seen.add(key);
      return key;
    });
    table.dataset.cols = JSON.stringify(keys);
  }
  for (const row of [...table.rows]) {
    if (row.dataset.colsTagged !== undefined || row.cells.length !== keys.length) continue;
    [...row.cells].forEach((cell, i) => (cell.dataset.col = keys[i]));
    row.dataset.colsTagged = "";
  }
  return keys;
}

// Порядок и видимость столбцов. Без настройки — исходный порядок, все видны (так же сбрасывается).
export function applyColumns(root: HTMLElement, layout: ColumnLayout | undefined) {
  const order = layout?.order ?? [];
  const hidden = new Set(layout?.hidden ?? []);
  tablesOf(root).forEach((table, tableIndex) => {
    const keys = tag(table, tableIndex);
    const wanted = [...order.filter((key) => keys.includes(key)), ...keys.filter((key) => !order.includes(key))];
    for (const row of [...table.rows]) {
      if (row.dataset.colsTagged === undefined) continue;
      const cells = new Map([...row.cells].map((cell) => [cell.dataset.col ?? "", cell]));
      const now = [...row.cells].map((cell) => cell.dataset.col);
      if (now.some((key, i) => key !== wanted[i])) wanted.forEach((key) => cells.get(key) && row.appendChild(cells.get(key)!));
      for (const [key, cell] of cells) cell.toggleAttribute("data-col-hidden", hidden.has(key));
    }
  });
}

// Таблицы окна для дерева «Настройки формы»: столбцы в исходном порядке.
export function describeTables(root: HTMLElement): TableInfo[] {
  const tables = tablesOf(root);
  return tables.map((table, index) => {
    const keys = tag(table, index);
    const labels = new Map(headCells(table).map((cell) => [cell.dataset.col ?? "", cellLabel(cell)]));
    const title = table.closest(".card")?.querySelector("h2, .card-title, .section-title")?.textContent?.trim();
    return {
      index,
      label: tables.length === 1 ? "Список" : title || `Таблица ${index + 1}`,
      columns: keys.map((key) => ({ key, label: labels.get(key) || key.replace(/^\d+:/, "") })),
    };
  });
}
