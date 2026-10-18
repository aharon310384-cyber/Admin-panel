"use client";

import { useState, useTransition } from "react";
import { Copy, Loader2, Trash2 } from "lucide-react";
import { checkExcelRow, type Checked, type ExcelCheckResult } from "@/actions/excel-import";

// «Загрузка из Excel» → шаг 1, проверка ИИ-разборщика: вставить большую ячейку строки, посмотреть, что нашёл ИИ.
// ✓ — значение есть в тексте ячейки, ⚠ — нет (ИИ мог ошибиться или додумать). Ничего не сохраняется.

type Run = { id: number; orderNumber: string; info: string; at: string; result: ExcelCheckResult };

const DELIVERY: Record<string, string> = { AIR: "авиа", SEA: "море", TRAIN: "ж/д", TRUCK: "авто" };

function Mark({ c }: { c: Checked }) {
  if (c.ok === null) return null;
  return c.ok ? (
    <span className="xc-ok" title={c.note ?? "Есть в тексте ячейки"}>✓</span>
  ) : (
    <span className="xc-bad" title={c.note ?? "Нет в тексте ячейки — проверьте"}>⚠</span>
  );
}

function Value({ c }: { c: Checked }) {
  return (
    <>
      {c.value ?? <span className="xc-muted">{c.note ?? "—"}</span>} <Mark c={c} />
      {c.value && c.note && c.ok && <span className="xc-muted xc-note"> {c.note}</span>}
    </>
  );
}

const money = (n: number | null, sign: string) => (n == null ? "—" : `${sign}${n.toFixed(2)}`);
const show = (c: Checked) => `${c.value ?? "—"}${c.ok === false ? " ⚠" : ""}`;

/** Итог одной проверки обычным текстом — чтобы переслать в чат. */
function summary(run: Run): string {
  const r = run.result;
  if (!r.ok) return `Строка ${run.orderNumber || "—"}: ошибка — ${r.error}`;
  const lines = [
    `Строка ${run.orderNumber || "—"} · курс ${r.rate} · клиент ${r.client ? `${r.client.code} ${r.client.name}` : r.clientCode ?? "—"}`,
    "Ячейка:",
    run.info.trim(),
    "Заказы:",
    ...r.orders.map(
      (o, i) =>
        `${i + 1}. трек ${show(o.track)} · ${show(o.name)} · ${o.quantity} шт · ${money(o.priceCny, "¥")} / ${money(o.priceUsd, "$")}${o.priceOk === false ? " ⚠" : ""}` +
        `${o.comment ? ` · ${o.comment}` : ""}${o.detailedCheck ? " · фото/проверка" : ""}${o.keepOriginalPackaging ? "" : " · без ориг. упаковки"}`,
    ),
  ];
  if (r.recipient) {
    const p = r.recipient;
    lines.push(
      `Получатель: ${show(p.name)} · ${show(p.address)} · тел. ${show(p.phone)} · страна ${p.countryCode ?? "—"}${p.countryName ? ` (${p.countryName})` : ""}`,
      `В справочнике клиента: ${r.recipientMatch ? r.recipientMatch.name : "нет"}`,
    );
  }
  if (r.warnings.length) lines.push("Предупреждения:", ...r.warnings.map((w) => `- ${w}`));
  return lines.join("\n");
}

export default function ExcelCheck({ defaultRate }: { defaultRate: number }) {
  const [orderNumber, setOrderNumber] = useState("");
  const [rate, setRate] = useState(String(defaultRate));
  const [info, setInfo] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [copied, setCopied] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const check = () =>
    startTransition(async () => {
      const result = await checkExcelRow({ orderNumber, rate, info }).catch(
        (): ExcelCheckResult => ({ ok: false, error: "Не получилось — попробуйте ещё раз" }),
      );
      const at = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
      setRuns((prev) => [{ id: Date.now(), orderNumber: orderNumber.trim().toUpperCase(), info, at, result }, ...prev]);
      if (result.ok) {
        setOrderNumber("");
        setInfo("");
      }
    });

  const copy = async (run: Run) => {
    try {
      await navigator.clipboard.writeText(summary(run));
      setCopied(run.id);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="xc">
      <section className="card xc-form">
        <h2 className="card-title">Проверка разборщика</h2>
        <p className="xc-hint">
          Скопируйте из Excel «большую ячейку» строки (трек-номера, товары, получатель, адрес, телефон) и вставьте ниже.
          ИИ разберёт её на заказы и получателя. <b>Ничего не сохраняется</b> — это проверка, что ИИ разбирает правильно.
        </p>
        <div className="xc-fields">
          <label className="xc-field">
            <span>Номер строки (order_number)</span>
            <input className="xc-input xc-mono" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="ABC0001UA" />
          </label>
          <label className="xc-field xc-field--rate">
            <span>Курс, ¥ за $</span>
            <input className="xc-input" value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" />
          </label>
        </div>
        <label className="xc-field">
          <span>Большая ячейка</span>
          <textarea className="xc-input xc-text" rows={7} value={info} onChange={(e) => setInfo(e.target.value)} spellCheck={false} />
        </label>
        <div className="xc-actions">
          <button type="button" className="xc-btn xc-btn--primary" onClick={check} disabled={pending || !info.trim()}>
            {pending && <Loader2 size={14} className="xc-spin" />} Разобрать
          </button>
          <span className="xc-muted">✓ — есть в тексте ячейки · ⚠ — нет в тексте, ИИ мог ошибиться</span>
        </div>
      </section>

      {runs.map((run) => (
        <section key={run.id} className="card xc-run">
          <div className="xc-run-head">
            <h3 className="xc-run-title">
              <span className="xc-mono">{run.orderNumber || "без номера"}</span>
              <span className="xc-muted"> · {run.at}{run.result.ok ? ` · курс ${run.result.rate}` : ""}</span>
            </h3>
            <button type="button" className="xc-btn" onClick={() => copy(run)}>
              <Copy size={13} /> {copied === run.id ? "Скопировано" : "Скопировать для чата"}
            </button>
            <button type="button" className="xc-btn xc-icon" onClick={() => setRuns((prev) => prev.filter((r) => r.id !== run.id))} aria-label="Убрать">
              <Trash2 size={13} />
            </button>
          </div>

          {!run.result.ok ? (
            <div className="xc-error">
              {run.result.error}
              {run.result.detail && <pre className="xc-pre">{run.result.detail}</pre>}
            </div>
          ) : (
            <RunResult run={run} result={run.result} />
          )}
        </section>
      ))}

      <style>{`
        .xc { display: flex; flex-direction: column; gap: 12px; font-size: 13px; }
        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 12px 14px; box-shadow: var(--shadow-card); }
        .card-title { font-size: 14px; font-weight: 600; margin: 0 0 8px; }
        .xc-hint { margin: 0 0 10px; color: var(--color-text-secondary); line-height: 1.5; }
        .xc-fields { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 8px; }
        .xc-field { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 200px; color: var(--color-muted); }
        .xc-field--rate { flex: 0 0 140px; min-width: 120px; }
        .xc-input { padding: 6px 9px; border: 1px solid var(--color-border-strong); border-radius: 4px; font: inherit; color: var(--color-text); background: #fff; }
        .xc-input:focus { outline: none; border-color: var(--color-accent); }
        .xc-text { resize: vertical; font-family: var(--font-mono); font-size: 12.5px; line-height: 1.45; }
        .xc-mono { font-family: var(--font-mono); }
        .xc-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
        .xc-btn { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 12px; border: 1px solid var(--color-border-strong); border-radius: 4px; background: #fff; color: var(--color-text); font: inherit; cursor: pointer; white-space: nowrap; }
        .xc-btn:hover:not(:disabled) { background: var(--color-muted-bg); }
        .xc-btn:disabled { opacity: 0.6; cursor: default; }
        .xc-btn--primary { background: var(--color-accent); border-color: var(--color-accent); color: #fff; font-weight: 600; }
        .xc-btn--primary:hover:not(:disabled) { background: var(--color-accent-hover); }
        .xc-icon { padding: 0 8px; color: var(--color-muted); }
        .xc-muted { color: var(--color-muted); }
        .xc-note { font-size: 11.5px; }
        .xc-ok { color: var(--color-success); font-weight: 700; }
        .xc-bad { color: var(--color-warning); font-weight: 700; }
        .xc-run-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .xc-run-title { flex: 1; margin: 0; font-size: 14px; font-weight: 600; min-width: 0; }
        .xc-error { color: var(--color-danger); }
        .xc-pre { margin: 6px 0 0; padding: 8px; max-height: 260px; overflow: auto; background: var(--color-muted-bg); border-radius: 4px; font-size: 11.5px; white-space: pre-wrap; word-break: break-word; color: var(--color-text); }
        .xc-table-wrap { overflow-x: auto; }
        .xc-table { width: 100%; border-collapse: collapse; }
        .xc-table th { text-align: left; padding: 5px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .xc-table td { padding: 5px 8px; border-bottom: 1px solid var(--color-border); vertical-align: top; }
        .xc-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .xc-recipient { margin: 10px 0 0; display: grid; grid-template-columns: 150px 1fr; gap: 4px 12px; }
        .xc-recipient dt { color: var(--color-muted); }
        .xc-recipient dd { margin: 0; word-break: break-word; }
        .xc-warn { margin: 10px 0 0; padding: 8px 10px 8px 26px; background: var(--color-warning-bg); color: var(--color-warning); border-radius: 4px; line-height: 1.5; }
        .xc-raw { margin-top: 8px; }
        .xc-raw summary { cursor: pointer; color: var(--color-accent); }
        .xc-spin { animation: xc-spin 0.8s linear infinite; }
        @keyframes xc-spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) { .xc-recipient { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

function RunResult({ run, result }: { run: Run; result: Extract<ExcelCheckResult, { ok: true }> }) {
  const p = result.recipient;
  return (
    <>
      <p className="xc-muted" style={{ margin: "0 0 8px" }}>
        Клиент: {result.client ? <b style={{ color: "var(--color-text)" }}>{result.client.code} — {result.client.name}</b> : result.clientCode ?? "—"}
      </p>
      <div className="xc-table-wrap">
        <table className="xc-table">
          <thead>
            <tr>
              <th>№</th><th>Входящий трек</th><th>Наименование</th><th className="xc-num">Кол-во</th>
              <th className="xc-num">Цена ¥</th><th className="xc-num">Цена $</th><th>Пожелания</th>
            </tr>
          </thead>
          <tbody>
            {result.orders.map((o, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td className="xc-mono"><Value c={o.track} /></td>
                <td><Value c={o.name} /></td>
                <td className="xc-num">{o.quantity}</td>
                <td className="xc-num">{money(o.priceCny, "¥")}</td>
                <td className="xc-num">
                  {money(o.priceUsd, "$")} {o.priceOk === false && <span className="xc-bad" title="Такой цены нет в тексте ячейки">⚠</span>}
                </td>
                <td>
                  {[o.comment, o.detailedCheck ? "фото / проверка" : null, o.keepOriginalPackaging ? null : "без оригинальной упаковки", o.deliveryType ? DELIVERY[o.deliveryType] : null]
                    .filter(Boolean)
                    .join(" · ") || <span className="xc-muted">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {p ? (
        <dl className="xc-recipient">
          <dt>Получатель</dt><dd><Value c={p.name} /></dd>
          <dt>Адрес</dt><dd><Value c={p.address} /></dd>
          <dt>Город, индекс</dt><dd>{[p.city, p.postalCode].filter(Boolean).join(", ") || <span className="xc-muted">—</span>}</dd>
          <dt>Страна</dt><dd>{p.countryCode ? `${p.countryCode}${p.countryName ? ` — ${p.countryName}` : " (нет в справочнике)"}` : <span className="xc-muted">не определена</span>}</dd>
          <dt>Телефон</dt><dd className="xc-mono"><Value c={p.phone} /></dd>
          {result.client && (
            <>
              <dt>У клиента в получателях</dt>
              <dd>{result.recipientMatch ? <span className="xc-ok">{result.recipientMatch.name}</span> : <span className="xc-bad">нет — нужно будет создать</span>}</dd>
            </>
          )}
        </dl>
      ) : null}

      {result.warnings.length > 0 && (
        <ul className="xc-warn">
          {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}

      <details className="xc-raw">
        <summary>Ячейка и ответ ИИ целиком</summary>
        <pre className="xc-pre">{run.info}</pre>
        <pre className="xc-pre">{result.raw}</pre>
      </details>
    </>
  );
}
