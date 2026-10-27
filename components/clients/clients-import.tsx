"use client";

// Список клиентов из Excel: файл → план (новые, изменятся, вернутся, без изменений, ошибки, нет в файле) → «Применить».
// Пока не нажато «Применить», в базе ничего не меняется. Клиентов, которых нет в файле, можно убрать из списка.

import { useState } from "react";
import Link from "next/link";
import { Check, FileSpreadsheet, Loader2 } from "lucide-react";
import { applyClientsFile, previewClientsFile, type ClientsImportResult } from "@/actions/clients-import";
import { CLIENT_IMPORT_LABELS, type ClientFileRow, type ClientImportAction, type ClientsImportPlan } from "@/lib/clients-import";

type Filter = ClientImportAction | "all" | "notInFile";

const ACTION_LABELS: Record<ClientImportAction, string> = {
  new: "новый",
  update: "изменится",
  restore: "вернётся в список",
  same: "без изменений",
  error: "ошибка — пропускается",
};
const FILTERS: [Filter, string][] = [
  ["all", "Все"],
  ["new", "Новые"],
  ["update", "Изменятся"],
  ["restore", "Вернутся"],
  ["same", "Без изменений"],
  ["error", "Ошибки"],
  ["notInFile", "Нет в файле"],
];

export default function ClientsImport() {
  const [busy, setBusy] = useState<"file" | "plan" | "apply" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<{ sheet: string; rows: ClientFileRow[] } | null>(null);
  const [plan, setPlan] = useState<ClientsImportPlan | null>(null);
  const [remove, setRemove] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<ClientsImportResult | null>(null);

  const upload = async (picked: File) => {
    setBusy("file");
    setError(null);
    setPlan(null);
    setResult(null);
    setConfirm(false);
    try {
      const form = new FormData();
      form.append("file", picked);
      const res = await fetch("/api/import/clients-file", { method: "POST", body: form });
      const data = (await res.json()) as { sheet?: string; rows?: ClientFileRow[]; error?: string };
      if (!res.ok || !data.rows) throw new Error(data.error ?? "Не удалось прочитать файл");
      if (!data.rows.length) throw new Error("В файле нет строк с кодом клиента");
      setFile({ sheet: data.sheet ?? "", rows: data.rows });
      setBusy("plan");
      const next = await previewClientsFile(data.rows);
      setPlan(next);
      setRemove(new Set(next.notInFile.map((c) => c.id)));
      setFilter("all");
    } catch (e) {
      setFile(null);
      setError(e instanceof Error ? e.message : "Не удалось прочитать файл");
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    if (!file) return;
    setBusy("apply");
    setError(null);
    try {
      const r = await applyClientsFile(file.rows, [...remove]);
      setResult(r);
      if (r.ok) {
        setPlan(null);
        setFile(null);
      }
    } catch {
      setResult({ ok: false, error: "Не получилось — попробуйте ещё раз" });
    } finally {
      setBusy(null);
      setConfirm(false);
    }
  };

  const count = (action: ClientImportAction) => plan?.rows.filter((r) => r.action === action).length ?? 0;
  const counts: Record<Filter, number> = {
    all: plan?.rows.length ?? 0,
    new: count("new"),
    update: count("update"),
    restore: count("restore"),
    same: count("same"),
    error: count("error"),
    notInFile: plan?.notInFile.length ?? 0,
  };
  const rows = plan?.rows.filter((r) => filter === "all" || r.action === filter) ?? [];
  const allRemove = Boolean(plan?.notInFile.length) && plan!.notInFile.every((c) => remove.has(c.id));
  const toggle = (id: string) =>
    setRemove((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const nothing = counts.new + counts.update + counts.restore + remove.size === 0;

  return (
    <div className="ci">
      <section className="card">
        <h2 className="card-title">Файл со списком клиентов</h2>
        <p className="ci-hint">
          Колонки узнаются по заголовкам: <b>client_code</b> (обязательно), last_name, first_name, middle_name, phone, user_name, e-mail,
          country, city. Пустая ячейка и «x» ничего не стирают. Страна берётся из справочника стран по-английски, город — по-английски.
          Пока вы не нажали «Применить», ничего не меняется.
        </p>
        <label className="ci-btn">
          {busy === "file" || busy === "plan" ? <Loader2 size={14} className="ci-spin" /> : <FileSpreadsheet size={14} />} Выбрать файл .xlsx
          <input
            type="file"
            accept=".xlsx"
            hidden
            disabled={busy !== null}
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (picked) void upload(picked);
              e.target.value = "";
            }}
          />
        </label>
        {busy === "plan" && <p className="ci-muted">Сверяю с базой: города кириллицей ищутся на карте по-английски, это несколько секунд…</p>}
        {error && <p className="ci-error">{error}</p>}
        {result && (
          <p className={result.ok ? "ci-ok" : "ci-error"} role="status">
            {result.ok ? (
              <>
                <Check size={14} /> Готово: новых {result.created}, изменено {result.updated}, возвращено {result.restored}, убрано из списка{" "}
                {result.removed}. <Link href="/clients">Открыть список клиентов</Link>
              </>
            ) : (
              result.error
            )}
          </p>
        )}
      </section>

      {plan && file && (
        <section className="card">
          <h2 className="card-title">
            Что изменится <span className="ci-muted">· лист «{file.sheet}», клиентов в файле: {file.rows.length}</span>
          </h2>
          <div className="ci-filters" role="tablist">
            {FILTERS.map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={filter === key} className={`ci-chip${filter === key ? " is-active" : ""}`} onClick={() => setFilter(key)}>
                {label} <span className="ci-muted">{counts[key]}</span>
              </button>
            ))}
          </div>

          {filter !== "notInFile" ? (
            <div className="ci-table-wrap">
              <table className="ci-table">
                <thead>
                  <tr>
                    <th>Строка</th><th>Код</th><th>Клиент</th><th>Что будет</th><th>Изменения</th><th>Заметки</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.excelRow}-${r.code}`}>
                      <td className="ci-muted">{r.excelRow}</td>
                      <td className="ci-mono">{r.code || "—"}</td>
                      <td>{r.name || "—"}</td>
                      <td><span className={`ci-act ci-act--${r.action}`}>{ACTION_LABELS[r.action]}</span></td>
                      <td>
                        {r.changes.length
                          ? r.changes.map((c) => (
                              <div key={c.field}>
                                <span className="ci-muted">{CLIENT_IMPORT_LABELS[c.field]}:</span> {c.from ? <s className="ci-muted">{c.from}</s> : null}
                                {c.from ? " → " : ""}
                                {c.to}
                              </div>
                            ))
                          : <span className="ci-muted">—</span>}
                      </td>
                      <td>{r.notes.length ? r.notes.map((n) => <div key={n} className={r.action === "error" ? "ci-bad" : "ci-note"}>{n}</div>) : null}</td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={6} className="ci-muted">Нет строк</td></tr>}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              <p className="ci-hint">
                Этих клиентов нет в файле. Отмеченные уберутся из списка клиентов; их посылки, заказы и получатели останутся в базе.
                Если клиент потом появится в файле снова — он вернётся.
              </p>
              <div className="ci-table-wrap">
                <table className="ci-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={allRemove}
                          onChange={() => setRemove(allRemove ? new Set() : new Set(plan.notInFile.map((c) => c.id)))}
                          aria-label="Отметить всех"
                        />
                      </th>
                      <th>Код</th><th>Клиент</th><th className="ci-num">Получателей</th><th className="ci-num">Заказов</th><th className="ci-num">Посылок</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.notInFile.map((c) => (
                      <tr key={c.id}>
                        <td><input type="checkbox" checked={remove.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Убрать ${c.code ?? c.name}`} /></td>
                        <td className="ci-mono">{c.code ?? "—"}</td>
                        <td>{c.name}</td>
                        <td className="ci-num">{c.recipients}</td>
                        <td className="ci-num">{c.orders}</td>
                        <td className="ci-num">{c.parcels}</td>
                      </tr>
                    ))}
                    {!plan.notInFile.length && <tr><td colSpan={6} className="ci-muted">Все клиенты из базы есть в файле</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="ci-actions">
            {confirm ? (
              <>
                <span>Точно применить?</span>
                <button type="button" className="ci-btn ci-btn--primary" onClick={() => void apply()} disabled={busy !== null}>
                  {busy === "apply" ? <Loader2 size={14} className="ci-spin" /> : <Check size={14} />} Да, применить
                </button>
                <button type="button" className="ci-btn" onClick={() => setConfirm(false)} disabled={busy !== null}>Отмена</button>
              </>
            ) : (
              <button type="button" className="ci-btn ci-btn--primary" onClick={() => setConfirm(true)} disabled={busy !== null || nothing}>
                Применить: новых {counts.new}, изменить {counts.update}, вернуть {counts.restore}, убрать {remove.size}
              </button>
            )}
            {counts.error > 0 && <span className="ci-bad">Строки с ошибками пропускаются ({counts.error}) — фильтр «Ошибки»</span>}
          </div>
        </section>
      )}

      <style>{`
        .ci { display: flex; flex-direction: column; gap: 12px; font-size: 13px; }
        .ci .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 12px 14px; box-shadow: var(--shadow-card); }
        .ci .card-title { font-size: 14px; font-weight: 600; margin: 0 0 8px; }
        .ci-hint { margin: 0 0 10px; color: var(--color-text-secondary); line-height: 1.5; }
        .ci-btn { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 12px; border: 1px solid var(--color-border-strong); border-radius: 4px; background: #fff; color: var(--color-text); font: inherit; cursor: pointer; white-space: nowrap; }
        .ci-btn:hover:not(:disabled) { background: var(--color-muted-bg); }
        .ci-btn:disabled { opacity: 0.6; cursor: default; }
        .ci-btn--primary { background: var(--color-accent); border-color: var(--color-accent); color: #fff; font-weight: 600; }
        .ci-btn--primary:hover:not(:disabled) { background: var(--color-accent-hover); }
        .ci-spin { animation: ci-spin 1s linear infinite; }
        @keyframes ci-spin { to { transform: rotate(360deg); } }
        .ci-muted { color: var(--color-muted); font-weight: 400; }
        .ci-mono { font-family: var(--font-mono); }
        .ci-ok { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 10px 0 0; color: var(--color-success); font-weight: 600; }
        .ci-ok a { color: inherit; text-decoration: underline; }
        .ci-error { margin: 10px 0 0; color: var(--color-danger); }
        .ci-bad { color: var(--color-danger); }
        .ci-note { color: var(--color-warning); }
        .ci-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
        .ci-chip { height: 26px; padding: 0 10px; border: 1px solid var(--color-border-strong); border-radius: 13px; background: #fff; font: inherit; cursor: pointer; }
        .ci-chip.is-active { background: #fde7b8; border-color: #e0a84a; }
        .ci-table-wrap { overflow-x: auto; max-height: 60dvh; overflow-y: auto; }
        .ci-table { width: 100%; border-collapse: collapse; }
        .ci-table th { position: sticky; top: 0; background: var(--color-surface); text-align: left; padding: 5px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .ci-table td { padding: 5px 8px; border-bottom: 1px solid var(--color-border); vertical-align: top; }
        .ci-num { text-align: right; font-variant-numeric: tabular-nums; }
        .ci-act { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 12px; white-space: nowrap; background: var(--color-muted-bg); }
        .ci-act--new { background: #dcf3e3; color: #1d6b3a; }
        .ci-act--update { background: #fde7b8; color: #7a4a00; }
        .ci-act--restore { background: #dbe9fb; color: #1f4f8f; }
        .ci-act--error { background: #fbdcdc; color: #9b1c1c; }
        .ci-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
      `}</style>
    </div>
  );
}
