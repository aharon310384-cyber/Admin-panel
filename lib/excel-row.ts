// Строка Excel, скопированная целиком (Ctrl+C): ячейки через табуляцию. Ячейка с переводами строк
// приходит в кавычках ("…"), кавычка внутри неё — двойная (""). Чистые функции, без базы.

/** Ячейки строки по порядку. Пробелы по краям ячеек убираются. */
export function splitExcelRow(text: string): string[] {
  const source = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  const cells: string[] = [];
  let cell = "";
  let i = 0;
  let atCellStart = true;
  while (i < source.length) {
    const ch = source[i];
    if (atCellStart && ch === '"') {
      // Ячейка в кавычках: до закрывающей кавычки, за которой табуляция или конец строки.
      i += 1;
      while (i < source.length) {
        if (source[i] === '"' && source[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else if (source[i] === '"') {
          i += 1;
          break;
        } else {
          cell += source[i];
          i += 1;
        }
      }
      atCellStart = false;
      continue;
    }
    if (ch === "\t") {
      cells.push(cell.trim());
      cell = "";
      atCellStart = true;
    } else {
      cell += ch;
      atCellStart = false;
    }
    i += 1;
  }
  cells.push(cell.trim());
  return cells;
}

/** Число из ячейки: «1 234,50», « 105,00 », «$107», «6,80» → 1234.5 / 105 / 107 / 6.8; пусто или не число — null. */
export function cellNumber(value: string | null | undefined): number | null {
  const cleaned = (value ?? "").replace(/[\s $¥€]/g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
