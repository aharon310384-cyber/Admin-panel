import "server-only";
import ExcelJS from "exceljs";
import { joinExcelRow } from "@/lib/excel-row";
import { columnIndex, type ExcelColumns } from "@/lib/excel-columns";
import { splitLegacyTaskNumber } from "@/lib/parcel-number";

// Загрузка из Excel файлом: лист → строки задач, каждая — как при копировании строки (с колонки номера строки),
// чтобы дальше работал тот же разбор, что и для вставленной строки (actions/excel-row.ts).

export type ExcelFileRow = { excelRow: number; taskNumber: string; text: string };
export type ExcelFileSheet = { name: string; rows: ExcelFileRow[] };

const pad = (n: number) => String(n).padStart(2, "0");

/** Значение ячейки так, как его видно в Excel: дата — «2026.10.07», формула — её результат, «ИСТИНА» — «+». */
function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return `${value.getUTCFullYear()}.${pad(value.getUTCMonth() + 1)}.${pad(value.getUTCDate())}`;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "+" : "";
  if (typeof value === "string") return value;
  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  if ("result" in value) return cellText((value.result ?? null) as ExcelJS.CellValue);
  if ("text" in value && typeof value.text === "string") return value.text;
  return "";
}

/** Строки листа, где в колонке номера строки — номер задачи (OG4283AE, SM3532US Galina). Заголовки и пустые строки пропускаются. */
function sheetRows(sheet: ExcelJS.Worksheet, columns: ExcelColumns): ExcelFileRow[] {
  const start = columnIndex(columns.taskNumber ?? "");
  if (start == null) return [];
  const used = Object.values(columns).map((letter) => columnIndex(letter ?? "") ?? 0);
  const end = Math.max(...used, start);
  const rows: ExcelFileRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, excelRow) => {
    const cells: string[] = [];
    for (let i = start; i <= end; i += 1) cells.push(cellText(row.getCell(i + 1).value).trim());
    const split = splitLegacyTaskNumber(cells[0] ?? "");
    if (!split.country || !/^[A-Z]{2,4}\d/.test(split.number)) return;
    rows.push({ excelRow, taskNumber: split.number, text: joinExcelRow(cells) });
  });
  return rows;
}

/** Все листы файла с их строками задач. */
export async function readExcelFile(data: ArrayBuffer, columns: ExcelColumns): Promise<ExcelFileSheet[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);
  return workbook.worksheets.map((sheet) => ({ name: sheet.name, rows: sheetRows(sheet, columns) }));
}
