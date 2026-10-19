"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Columns3, Loader2, Save, UserPlus } from "lucide-react";
import {
  createRecipientFromRow,
  previewExcelRow,
  saveExcelColumns,
  saveExcelRow,
  type ExcelRowPreview,
  type ExcelRowSaveResult,
} from "@/actions/excel-row";
import { EXCEL_FIELDS, type ExcelColumns } from "@/lib/excel-columns";
import { parcelStatusLabel } from "@/lib/statuses";

// «Загрузка из Excel», шаг 2: строка листа целиком → что будет сохранено → «Сохранить в базу» (заказы → задача → посылка).
// Колонки листа (буквы Excel) — настройка сверху. ИИ находит только треки; остальное — из колонок.

const money = (n: number | null, sign: string) => (n == null ? "—" : `${sign}${n.toFixed(2)}`);
const dateLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("ru-RU", { timeZone: "UTC" }) : null);

export default function ExcelRow({ initialColumns }: { initialColumns: ExcelColumns }) {
  const [columns, setColumns] = useState<Record<string, string>>({ ...initialColumns });
  const [columnsOpen, setColumnsOpen] = useState(!initialColumns.taskNumber || !initialColumns.info);
  const [columnsMessage, setColumnsMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ExcelRowPreview | null>(null);
  const [error, setError] = useState<{ text: string; detail?: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState<Extract<ExcelRowSaveResult, { ok: true }> | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<void>) =>
    startTransition(async () => {
      try {
        await action();
      } catch {
        setError({ text: "Не получилось — попробуйте ещё раз" });
      }
    });

  const saveColumns = () =>
    run(async () => {
      const result = await saveExcelColumns(columns);
      setColumnsMessage({ ok: result.ok, text: result.message });
      if (result.ok) setColumnsOpen(false);
    });

  const check = () =>
    run(async () => {
      setError(null);
      setNotice(null);
      setSaved(null);
      const result = await previewExcelRow(text);
      if (result.ok) setPreview(result.preview);
      else {
        setPreview(null);
        setError({ text: result.error, detail: result.detail });
      }
    });

  const createRecipient = () =>
    run(async () => {
      const result = await createRecipientFromRow(text);
      setNotice(result.message);
      if (!result.ok) return;
      const again = await previewExcelRow(text);
      if (again.ok) setPreview(again.preview);
    });

  const save = () =>
    run(async () => {
      if (!preview) return;
      const result = await saveExcelRow(text, preview.found);
      if (result.ok) {
        setSaved(result);
        setError(null);
      } else setError({ text: result.error });
    });

  const recipientMissing = Boolean(preview?.client && !preview.recipientMatch && preview.recipient.name);

  return (
    <div className="xr">
      <section className="card">
        <div className="xr-head">
          <h2 className="card-title">Колонки листа</h2>
          <button type="button" className="xr-btn" onClick={() => setColumnsOpen((v) => !v)}>
            <Columns3 size={13} /> {columnsOpen ? "Скрыть" : "Показать"}
          </button>
        </div>
        {columnsOpen ? (
          <>
            <p className="xr-hint">
              Буква колонки Excel для каждого поля. Строку копируют начиная с колонки номера строки. Пустое поле — не загружается.
            </p>
            <div className="xr-columns">
              {EXCEL_FIELDS.map((f) => (
                <label key={f.key} className="xr-column">
                  <input
                    className="xr-input xr-letter"
                    value={columns[f.key] ?? ""}
                    onChange={(e) => setColumns((prev) => ({ ...prev, [f.key]: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) }))}
                    aria-label={f.label}
                  />
                  <span>{f.label}{"required" in f && f.required ? " *" : ""}</span>
                </label>
              ))}
            </div>
            <div className="xr-actions">
              <button type="button" className="xr-btn xr-btn--primary" onClick={saveColumns} disabled={pending}>Сохранить колонки</button>
              {columnsMessage && <span className={columnsMessage.ok ? "xr-ok" : "xr-bad"}>{columnsMessage.text}</span>}
            </div>
          </>
        ) : (
          columnsMessage && <p className={columnsMessage.ok ? "xr-ok" : "xr-bad"} style={{ margin: 0 }}>{columnsMessage.text}</p>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">Строка Excel</h2>
        <p className="xr-hint">
          В Excel выделите строку начиная с колонки номера строки, нажмите Ctrl+C и вставьте сюда. Система покажет, что будет сохранено;
          в базу запись идёт только по кнопке «Сохранить в базу».
        </p>
        <textarea className="xr-input xr-text" rows={5} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
        <div className="xr-actions">
          <button type="button" className="xr-btn xr-btn--primary" onClick={check} disabled={pending || !text.trim()}>
            {pending && <Loader2 size={14} className="xr-spin" />} Разобрать
          </button>
          <span className="xr-muted">✓ — трек есть в тексте ячейки · ⚠ — нет, проверьте</span>
        </div>
        {error && (
          <div className="xr-error" role="alert">
            {error.text}
            {error.detail && <pre className="xr-pre">{error.detail}</pre>}
          </div>
        )}
      </section>

      {preview && (
        <section className="card">
          <div className="xr-head">
            <h2 className="card-title">
              <span className="xr-mono">{preview.taskNumber}</span>
              <span className="xr-muted">
                {" "}· {preview.client ? `${preview.client.code} — ${preview.client.name}` : `клиент ${preview.clientCode ?? "?"}`}
                {" "}· {preview.countryCode}{preview.countryName ? ` — ${preview.countryName}` : ""}
              </span>
            </h2>
          </div>
          <p className="xr-muted" style={{ margin: "0 0 8px" }}>
            {saved
              ? null
              : preview.existing
                ? <>Строка уже загружена{preview.existing.parcelNumber ? ` (посылка ${preview.existing.parcelNumber})` : ""} — сохранение обновит документы.</>
                : "В базу ещё не записано."}
          </p>

          {preview.blockers.length > 0 && (
            <ul className="xr-block">
              {preview.blockers.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          )}
          {recipientMissing && (
            <div className="xr-actions" style={{ marginBottom: 8 }}>
              <button type="button" className="xr-btn" onClick={createRecipient} disabled={pending}>
                <UserPlus size={13} /> Создать получателя из строки
              </button>
              <span className="xr-muted">ФИО, адрес и телефон — из строки, страна — {preview.countryCode}. Потом можно дополнить в «Получатели».</span>
            </div>
          )}
          {notice && <p className="xr-ok" style={{ margin: "0 0 8px" }}>{notice}</p>}

          <div className="xr-table-wrap">
            <table className="xr-table">
              <thead>
                <tr><th>№</th><th>Входящий трек</th><th>Наименование</th><th className="xr-num">Кол-во</th><th>Комментарий клиента</th></tr>
              </thead>
              <tbody>
                {preview.tracks.map((t, i) =>
                  t.items.map((item, j) => (
                    <tr key={`${i}-${j}`} className={j < t.items.length - 1 ? "xr-same" : undefined}>
                      {j === 0 && <td rowSpan={t.items.length}>{i + 1}</td>}
                      {j === 0 && (
                        <td rowSpan={t.items.length} className="xr-mono xr-track">
                          {t.track ?? <span className="xr-muted">без трека</span>}{" "}
                          {t.inText === true && <span className="xr-ok" title="Есть в тексте ячейки">✓</span>}
                          {t.inText === false && <span className="xr-bad" title="Нет в тексте ячейки — проверьте">⚠</span>}
                        </td>
                      )}
                      <td>{item.name ?? <span className="xr-muted">не указано</span>}</td>
                      <td className="xr-num">{item.quantity}</td>
                      <td>{item.comment ?? <span className="xr-muted">—</span>}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>

          <div className="xr-grid">
            <dl className="xr-dl">
              <dt>Получатель</dt>
              <dd>
                {preview.recipient.name ?? "—"}{" "}
                {preview.recipientMatch ? <span className="xr-ok">✓ есть у клиента</span> : preview.client && <span className="xr-bad">нет у клиента</span>}
              </dd>
              <dt>Адрес</dt><dd>{preview.recipient.address ?? "—"}</dd>
              <dt>Телефон</dt><dd className="xr-mono">{preview.recipient.phone ?? "—"}</dd>
              <dt>Трек посылки</dt><dd className="xr-mono">{preview.parcelTrack ?? "—"}</dd>
              <dt>Дата отправки</dt><dd>{dateLabel(preview.sentDate) ?? "—"}</dd>
              <dt>Статус посылки</dt><dd>{parcelStatusLabel(preview.status)}</dd>
              <dt>Оплата</dt><dd>{preview.paid ? <span className="xr-ok">оплачена</span> : "не оплачена"}</dd>
              {preview.internalComment && (<><dt>Внутренний комментарий задачи</dt><dd>{preview.internalComment}</dd></>)}
            </dl>
            <dl className="xr-dl">
              <dt>Вес</dt><dd>{preview.weightKg != null ? `${preview.weightKg} кг` : "—"}</dd>
              <dt>Стоимость товаров</dt><dd>{money(preview.goodsValueUsd, "$")}</dd>
              <dt>Отправка</dt><dd>{money(preview.shippingUsd, "$")}</dd>
              {preview.services.map((s) => (
                <span key={s.code} style={{ display: "contents" }}>
                  <dt>{s.name}</dt><dd>{s.code === "LOCAL_DELIVERY" ? money(s.cny, "¥") : money(s.usd, "$")}</dd>
                </span>
              ))}
              <dt>Итого, $</dt><dd>{money(preview.totalUsd, "$")}</dd>
              <dt>Курс</dt><dd>{preview.rate}{preview.rateFromRow ? "" : " (из настроек)"}</dd>
              {preview.dutyCny != null && (<><dt>Пошлина ЕС</dt><dd>{preview.euItemKinds} вид. · {money(preview.dutyCny, "¥")}</dd></>)}
              {preview.discountPercent != null && (<><dt>Скидка</dt><dd>{preview.discountPercent}%</dd></>)}
              <dt>Итого, ¥</dt><dd><b>{money(preview.totalCny, "¥")}</b></dd>
            </dl>
            <dl className="xr-dl xr-internal">
              <dt className="xr-internal-title">Только сотрудники</dt><dd />
              <dt>Стоимость отправки для нас</dt><dd>{money(preview.carrierCostCny, "¥")}</dd>
              <dt>Выручка</dt><dd>{money(preview.revenueCny, "¥")}</dd>
            </dl>
          </div>

          {preview.warnings.length > 0 && (
            <ul className="xr-warn">
              {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}

          <div className="xr-actions xr-save">
            <button type="button" className="xr-btn xr-btn--primary" onClick={save} disabled={pending || preview.blockers.length > 0}>
              {pending ? <Loader2 size={14} className="xr-spin" /> : <Save size={14} />} {preview.existing ? "Обновить в базе" : "Сохранить в базу"}
            </button>
            {preview.blockers.length > 0 && <span className="xr-muted">Сначала исправьте то, что отмечено красным.</span>}
            {saved && (
              <span className="xr-ok" role="status">
                {saved.created ? "Сохранено" : "Обновлено"}: задача {saved.taskNumber}, посылка{" "}
                <Link href={`/parcels/${saved.parcelId}`}>{saved.parcelNumber}</Link>
              </span>
            )}
          </div>
        </section>
      )}

      <style>{`
        .xr { display: flex; flex-direction: column; gap: 12px; font-size: 13px; }
        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 12px 14px; box-shadow: var(--shadow-card); }
        .card-title { font-size: 14px; font-weight: 600; margin: 0; }
        .xr-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
        .xr-hint { margin: 0 0 10px; color: var(--color-text-secondary); line-height: 1.5; }
        .xr-input { padding: 6px 9px; border: 1px solid var(--color-border-strong); border-radius: 4px; font: inherit; color: var(--color-text); background: #fff; }
        .xr-input:focus { outline: none; border-color: var(--color-accent); }
        .xr-text { width: 100%; resize: vertical; font-family: var(--font-mono); font-size: 12.5px; line-height: 1.45; }
        .xr-columns { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 6px 14px; }
        .xr-column { display: flex; align-items: center; gap: 8px; color: var(--color-text); }
        .xr-letter { width: 52px; text-align: center; font-family: var(--font-mono); text-transform: uppercase; padding: 4px 6px; }
        .xr-mono { font-family: var(--font-mono); }
        .xr-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
        .xr-btn { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 12px; border: 1px solid var(--color-border-strong); border-radius: 4px; background: #fff; color: var(--color-text); font: inherit; cursor: pointer; white-space: nowrap; }
        .xr-btn:hover:not(:disabled) { background: var(--color-muted-bg); }
        .xr-btn:disabled { opacity: 0.6; cursor: default; }
        .xr-btn--primary { background: var(--color-accent); border-color: var(--color-accent); color: #fff; font-weight: 600; }
        .xr-btn--primary:hover:not(:disabled) { background: var(--color-accent-hover); }
        .xr-muted { color: var(--color-muted); }
        .xr-ok { color: var(--color-success); font-weight: 600; }
        .xr-ok a { color: inherit; text-decoration: underline; }
        .xr-bad { color: var(--color-warning); font-weight: 600; }
        .xr-error { margin-top: 8px; color: var(--color-danger); }
        .xr-pre { margin: 6px 0 0; padding: 8px; max-height: 260px; overflow: auto; background: var(--color-muted-bg); border-radius: 4px; font-size: 11.5px; white-space: pre-wrap; word-break: break-word; color: var(--color-text); }
        .xr-block { margin: 0 0 8px; padding: 8px 10px 8px 26px; background: var(--color-warning-bg); color: var(--color-danger); border-radius: 4px; line-height: 1.5; }
        .xr-warn { margin: 10px 0 0; padding: 8px 10px 8px 26px; background: var(--color-warning-bg); color: var(--color-warning); border-radius: 4px; line-height: 1.5; }
        .xr-table-wrap { overflow-x: auto; }
        .xr-table { width: 100%; border-collapse: collapse; }
        .xr-table th { text-align: left; padding: 5px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .xr-table td { padding: 5px 8px; border-bottom: 1px solid var(--color-border); vertical-align: top; }
        .xr-table tr.xr-same td:not([rowspan]) { border-bottom-style: dashed; }
        .xr-track { border-right: 1px solid var(--color-border); }
        .xr-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .xr-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 4px 24px; margin-top: 10px; }
        .xr-dl { margin: 0; display: grid; grid-template-columns: minmax(120px, auto) 1fr; gap: 4px 12px; align-content: start; }
        .xr-dl dt { color: var(--color-muted); }
        .xr-dl dd { margin: 0; word-break: break-word; }
        .xr-internal { padding: 8px 10px; border: 1px dashed var(--color-border-strong); border-radius: 4px; }
        .xr-internal-title { font-weight: 700; color: var(--color-text) !important; }
        .xr-save { margin-top: 12px; }
        .xr-spin { animation: xr-spin 0.8s linear infinite; }
        @keyframes xr-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
