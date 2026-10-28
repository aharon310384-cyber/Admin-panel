import "server-only";
import ExcelJS from "exceljs";
import { cellText } from "@/lib/excel-file";
import { CLIENT_FILE_COLUMNS, type ClientFileField, type ClientFileRow } from "@/lib/clients-import";

// Список клиентов файлом .xlsx: первая строка с колонкой кода клиента — заголовки, дальше — клиенты.
// Колонки узнаются по заголовкам (client_code, last_name, … или по-русски), порядок не важен.

const HEADER_ROWS = 10;
const norm = (text: string) => text.trim().toLowerCase().replace(/[\s_-]+/g, " ");

function headerMap(row: ExcelJS.Row): Partial<Record<ClientFileField, number>> {
  const map: Partial<Record<ClientFileField, number>> = {};
  row.eachCell((cell, col) => {
    const title = norm(cellText(cell.value));
    for (const [field, names] of Object.entries(CLIENT_FILE_COLUMNS) as [ClientFileField, string[]][]) {
      if (map[field] == null && names.some((name) => norm(name) === title)) map[field] = col;
    }
  });
  return map;
}

export type ClientsFileResult = { ok: true; sheet: string; rows: ClientFileRow[]; columns: ClientFileField[] } | { ok: false; error: string };

/** Клиенты из файла: лист, где нашлась колонка кода клиента. */
export async function readClientsFile(data: ArrayBuffer): Promise<ClientsFileResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);
  for (const sheet of workbook.worksheets) {
    for (let r = 1; r <= Math.min(HEADER_ROWS, sheet.rowCount); r += 1) {
      const columns = headerMap(sheet.getRow(r));
      if (columns.code == null) continue;
      const rows: ClientFileRow[] = [];
      sheet.eachRow({ includeEmpty: false }, (row, excelRow) => {
        if (excelRow <= r) return;
        const values: ClientFileRow["values"] = {};
        for (const [field, col] of Object.entries(columns) as [ClientFileField, number][]) {
          const text = cellText(row.getCell(col).value).trim();
          if (text) values[field] = text.slice(0, 200);
        }
        if (values.code) rows.push({ excelRow, values });
      });
      return { ok: true, sheet: sheet.name, rows, columns: Object.keys(columns) as ClientFileField[] };
    }
  }
  return { ok: false, error: "В файле не найдена колонка с кодом клиента (заголовок client_code или «Код»)" };
}
