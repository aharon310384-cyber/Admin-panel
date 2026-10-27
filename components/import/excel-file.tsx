"use client";

import { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Play, Square } from "lucide-react";
import { importExcelRow } from "@/actions/excel-row";
import { splitExcelRow } from "@/lib/excel-row";
import { cellOf, type ExcelColumns } from "@/lib/excel-columns";

// «Загрузка из Excel» файлом: .xlsx → строки задач листа → отметить → «Загрузить отмеченные».
// Каждая строка идёт тем же путём, что и вставленная вручную (ИИ ищет треки, затем сохранение), по нескольку одновременно.

type FileRow = { excelRow: number; taskNumber: string; text: string; inBase: boolean; clientExists: boolean };
type Sheet = { name: string; rows: FileRow[] };
type Result = { ok: boolean; text: string };
type Filter = "all" | "new" | "inBase" | "noClient" | "done" | "failed";

const PARALLEL = 3;
const PAGE = 300;

/** Повтор номера в файле: загружается только первая такая строка. */
function duplicateRows(rows: FileRow[]): Set<number> {
  const seen = new Set<string>();
  const dup = new Set<number>();
  for (const r of rows) {
    if (seen.has(r.taskNumber)) dup.add(r.excelRow);
    seen.add(r.taskNumber);
  }
  return dup;
}

export default function ExcelFile({ columns }: { columns: ExcelColumns }) {
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [sheetName, setSheetName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<Filter>("new");
  const [shown, setShown] = useState(PAGE);
  const [createRecipients, setCreateRecipients] = useState(true);
  const [results, setResults] = useState<Map<number, Result>>(new Map());
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ total: number; processed: number } | null>(null);
  const stop = useRef(false);

  const sheet = sheets?.find((s) => s.name === sheetName) ?? null;
  const duplicates = useMemo(() => duplicateRows(sheet?.rows ?? []), [sheet]);

  const info = (r: FileRow) => {
    const cells = splitExcelRow(r.text);
    return {
      recipient: cellOf(cells, columns, "recipientName"),
      date: cellOf(cells, columns, "sentDate"),
      total: cellOf(cells, columns, "totalCny"),
    };
  };

  const selectable = (r: FileRow) => r.clientExists && !duplicates.has(r.excelRow);
  const defaultChecked = (rows: FileRow[]) => {
    const dup = duplicateRows(rows);
    return new Set(rows.filter((r) => r.clientExists && !dup.has(r.excelRow) && !r.inBase).map((r) => r.excelRow));
  };

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    setResults(new Map());
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/import/excel-file", { method: "POST", body: form });
      const data = (await res.json()) as { sheets?: Sheet[]; error?: string };
      if (!res.ok || !data.sheets) throw new Error(data.error ?? "Не удалось прочитать файл");
      const best = [...data.sheets].sort((a, b) => b.rows.length - a.rows.length)[0];
      setSheets(data.sheets);
      setSheetName(best?.name ?? "");
      setChecked(defaultChecked(best?.rows ?? []));
      setShown(PAGE);
      if (!best?.rows.length) setError("В файле не найдено строк с номером задачи — проверьте колонку номера строки в «Колонки листа».");
    } catch (e) {
      setSheets(null);
      setError(e instanceof Error ? e.message : "Не удалось прочитать файл");
    } finally {
      setUploading(false);
    }
  };

  const chooseSheet = (name: string) => {
    setSheetName(name);
    setChecked(defaultChecked(sheets?.find((s) => s.name === name)?.rows ?? []));
    setResults(new Map());
    setShown(PAGE);
  };

  const filtered = (sheet?.rows ?? []).filter((r) => {
    const res = results.get(r.excelRow);
    if (filter === "new") return !r.inBase && !res;
    if (filter === "inBase") return r.inBase;
    if (filter === "noClient") return !r.clientExists;
    if (filter === "done") return res?.ok;
    if (filter === "failed") return res && !res.ok;
    return true;
  });
  const visibleSelectable = filtered.filter(selectable);
  const allChecked = visibleSelectable.length > 0 && visibleSelectable.every((r) => checked.has(r.excelRow));
  const toggleAll = () =>
    setChecked((prev) => {
      const next = new Set(prev);
      for (const r of visibleSelectable) {
        if (allChecked) next.delete(r.excelRow);
        else next.add(r.excelRow);
      }
      return next;
    });
  const toggle = (row: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });

  const run = async () => {
    if (!sheet) return;
    const queue = sheet.rows.filter((r) => checked.has(r.excelRow) && !results.get(r.excelRow)?.ok);
    if (!queue.length) return;
    stop.current = false;
    setRunning(true);
    setProgress({ total: queue.length, processed: 0 });
    const worker = async () => {
      while (!stop.current) {
        const row = queue.shift();
        if (!row) return;
        let result: Result;
        try {
          const r = await importExcelRow(row.text, { createRecipient: createRecipients });
          result = r.ok
            ? {
                ok: true,
                text: `${r.created ? "загружена" : "обновлена"} · ${r.parcelNumber}${r.recipientCreated ? ` · новый получатель ${r.recipientCreated}` : ""}${r.tracking ? " · на слежение" : ""}`,
              }
            : { ok: false, text: r.error };
        } catch {
          result = { ok: false, text: "не получилось — попробуйте ещё раз" };
        }
        setResults((prev) => new Map(prev).set(row.excelRow, result));
        setProgress((prev) => (prev ? { ...prev, processed: prev.processed + 1 } : prev));
        if (result.ok) setChecked((prev) => {
          const next = new Set(prev);
          next.delete(row.excelRow);
          return next;
        });
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    setRunning(false);
  };

  const done = [...results.values()].filter((r) => r.ok).length;
  const failed = [...results.values()].filter((r) => !r.ok).length;
  const counts = {
    all: sheet?.rows.length ?? 0,
    new: (sheet?.rows ?? []).filter((r) => !r.inBase && !results.get(r.excelRow)).length,
    inBase: (sheet?.rows ?? []).filter((r) => r.inBase).length,
    noClient: (sheet?.rows ?? []).filter((r) => !r.clientExists).length,
    done,
    failed,
  };
  const FILTERS: [Filter, string][] = [["new", "Новые"], ["inBase", "Уже в базе"], ["noClient", "Нет клиента"], ["done", "Загружены"], ["failed", "Ошибки"], ["all", "Все"]];

  return (
    <section className="card">
      <h2 className="card-title">Файл Excel</h2>
      <p className="xr-hint">
        Файл .xlsx целиком — для старых строк. Система найдёт строки с номером задачи, вы отметите нужные и нажмёте «Загрузить отмеченные».
        Строки, которые уже в базе, по умолчанию не отмечены: отметьте их, чтобы обновить.
      </p>
      <div className="xr-actions" style={{ marginTop: 0 }}>
        <label className="xr-btn">
          {uploading ? <Loader2 size={14} className="xr-spin" /> : <FileSpreadsheet size={14} />} Выбрать файл .xlsx
          <input
            type="file"
            accept=".xlsx"
            hidden
            disabled={uploading || running}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
        </label>
        {sheets && sheets.length > 1 && (
          <select className="xr-input" value={sheetName} onChange={(e) => chooseSheet(e.target.value)} disabled={running} aria-label="Лист">
            {sheets.map((s) => <option key={s.name} value={s.name}>{s.name} — строк: {s.rows.length}</option>)}
          </select>
        )}
      </div>
      {error && <p className="xr-error">{error}</p>}

      {sheet && sheet.rows.length > 0 && (
        <>
          <div className="xr-filters" role="tablist">
            {FILTERS.map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={filter === key} className={`xr-chip${filter === key ? " is-active" : ""}`} onClick={() => { setFilter(key); setShown(PAGE); }}>
                {label} <span className="xr-muted">{counts[key]}</span>
              </button>
            ))}
          </div>
          <div className="xr-table-wrap xr-file-list">
            <table className="xr-table">
              <thead>
                <tr>
                  <th><input type="checkbox" checked={allChecked} onChange={toggleAll} disabled={running} aria-label="Отметить все" /></th>
                  <th>Строка</th><th>Номер</th><th>Получатель</th><th>Дата</th><th className="xr-num">Итого ¥</th><th>Состояние</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, shown).map((r) => {
                  const res = results.get(r.excelRow);
                  const i = info(r);
                  return (
                    <tr key={r.excelRow}>
                      <td>
                        <input type="checkbox" checked={checked.has(r.excelRow)} onChange={() => toggle(r.excelRow)} disabled={running || !selectable(r)} aria-label={`Отметить ${r.taskNumber}`} />
                      </td>
                      <td className="xr-muted">{r.excelRow}</td>
                      <td className="xr-mono">{r.taskNumber}</td>
                      <td>{i.recipient ?? "—"}</td>
                      <td className="xr-muted">{i.date ?? "—"}</td>
                      <td className="xr-num">{i.total ?? "—"}</td>
                      <td>
                        {res ? (
                          <span className={res.ok ? "xr-ok" : "xr-bad"}>{res.text}</span>
                        ) : !r.clientExists ? (
                          <span className="xr-bad">нет клиента {r.taskNumber.match(/^[A-Z]{2,4}(?=\d)/)?.[0]}</span>
                        ) : duplicates.has(r.excelRow) ? (
                          <span className="xr-bad">номер повторяется в файле</span>
                        ) : r.inBase ? (
                          <span className="xr-muted">уже в базе</span>
                        ) : (
                          <span className="xr-muted">новая</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={7} className="xr-muted">Нет строк</td></tr>}
              </tbody>
            </table>
          </div>
          {filtered.length > shown && (
            <button type="button" className="xr-btn" style={{ marginTop: 8 }} onClick={() => setShown((n) => n + PAGE)}>
              Показать ещё ({filtered.length - shown})
            </button>
          )}
          <div className="xr-actions">
            <label className="xr-check">
              <input type="checkbox" checked={createRecipients} onChange={(e) => setCreateRecipients(e.target.checked)} disabled={running} />
              Нет получателя у клиента — создать из строки
            </label>
          </div>
          <div className="xr-actions">
            {running ? (
              <button type="button" className="xr-btn" onClick={() => { stop.current = true; }}>
                <Square size={13} /> Остановить
              </button>
            ) : (
              <button type="button" className="xr-btn xr-btn--primary" onClick={() => void run()} disabled={checked.size === 0}>
                <Play size={13} /> Загрузить отмеченные ({checked.size})
              </button>
            )}
            {progress && (
              <span className="xr-muted" role="status">
                {running && <Loader2 size={13} className="xr-spin" />} Обработано {progress.processed} из {progress.total} · загружено всего: {done}
                {failed ? ` · ошибок: ${failed} (фильтр «Ошибки»)` : ""}
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
