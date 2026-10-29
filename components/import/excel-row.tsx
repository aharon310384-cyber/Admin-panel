"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ClipboardPaste, Columns3, Copy, Loader2, Save } from "lucide-react";
import {
  previewExcelRow,
  saveExcelColumns,
  saveExcelDelivery,
  saveExcelRow,
  type ExcelRowChoice,
  type ExcelRowPreview,
  type ExcelRowSaveResult,
} from "@/actions/excel-row";
import { EXCEL_FIELDS, alignRow, type ExcelColumns, type ExcelDelivery } from "@/lib/excel-columns";
import { splitExcelRow } from "@/lib/excel-row";
import { parcelStatusLabel } from "@/lib/statuses";
import ExcelFile from "@/components/import/excel-file";

// «Загрузка из Excel», шаг 2: строка листа целиком → что будет сохранено → «Сохранить в базу» (заказы → задача → посылка).
// Колонки листа (буквы Excel) — настройка сверху. ИИ находит только треки; остальное — из колонок.

const money = (n: number | null, sign: string) => (n == null ? "—" : `${sign}${n.toFixed(2)}`);
// Дата отправки из строки — день без часового пояса: год.месяц.день, как везде.
const dateLabel = (iso: string | null) => (iso ? iso.slice(0, 10).replaceAll("-", ".") : null);

/** Номер строки без приписки: «OG4283AE объем» → «OG4283AE». */
const taskOf = (value: string | null | undefined) => value?.trim().match(/^[A-Za-z]{2,4}\d+[A-Za-z]{2,4}/)?.[0].toUpperCase() ?? null;

/**
 * fromExcel — номер строки из кнопки «Отправить» в Excel (?row=OG4283AE): строку админка берёт из скопированного (Ctrl+C),
 * потому что в ссылку Excel вся строка не помещается (не больше 255 символов).
 */
type DeliveryRow = { code: string; type: string };

export default function ExcelRow({
  initialColumns,
  initialDelivery,
  deliveryMethods,
  fromExcel,
}: {
  initialColumns: ExcelColumns;
  initialDelivery: ExcelDelivery;
  deliveryMethods: { code: string; name: string }[];
  fromExcel: string | null;
}) {
  const [columns, setColumns] = useState<Record<string, string>>({ ...initialColumns });
  // «Тарифный план → вид доставки»: строки кодов и вид для остальных кодов
  const [deliveryRows, setDeliveryRows] = useState<DeliveryRow[]>(
    Object.entries(initialDelivery.codes).map(([code, type]) => ({ code, type })),
  );
  const [deliveryFallback, setDeliveryFallback] = useState(initialDelivery.fallback ?? "");
  const [deliveryMessage, setDeliveryMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [choice, setChoice] = useState<ExcelRowChoice>({});
  const [columnsOpen, setColumnsOpen] = useState(!initialColumns.taskNumber || !initialColumns.info);
  const [columnsMessage, setColumnsMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ExcelRowPreview | null>(null);
  const [error, setError] = useState<{ text: string; detail?: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState<Extract<ExcelRowSaveResult, { ok: true }> | null>(null);
  const [clipboard, setClipboard] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [formulaCopied, setFormulaCopied] = useState(false);
  const tried = useRef(false);
  const expected = taskOf(fromExcel);
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

  const saveDelivery = () =>
    run(async () => {
      const result = await saveExcelDelivery(deliveryRows, deliveryFallback || null);
      setDeliveryMessage({ ok: result.ok, text: result.message });
    });

  const check = (value = text) =>
    run(async () => {
      setError(null);
      setNotice(null);
      setSaved(null);
      setChoice({});
      const result = await previewExcelRow(value);
      if (result.ok) setPreview(result.preview);
      else {
        setPreview(null);
        setError({ text: result.error, detail: result.detail });
      }
    });

  /** Номер строки во вставленном тексте (строка может быть скопирована и с колонки A). */
  const pastedTask = (value: string) => taskOf(alignRow(splitExcelRow(value), columns as ExcelColumns)[0]);

  /** Строка из буфера (Ctrl+C в Excel): та самая — сразу разобрать; другая или нет доступа — подсказать. */
  const takeClipboard = async () => {
    try {
      const value = await navigator.clipboard.readText();
      const task = pastedTask(value);
      if (!value.trim() || !task) {
        setClipboard(`В буфере нет строки Excel. В Excel щёлкните по номеру строки ${expected ?? ""} слева, нажмите Ctrl+C и потом «Вставить из буфера».`);
      } else if (expected && task !== expected) {
        setClipboard(`В буфере строка ${task}, а нажата кнопка у ${expected}. Скопируйте строку ${expected} (Ctrl+C) и нажмите «Вставить из буфера».`);
      } else {
        setClipboard(null);
        setText(value);
        check(value);
      }
    } catch {
      setClipboard("Браузер не дал прочитать скопированное: нажмите «Вставить из буфера» и разрешите доступ, или вставьте строку в поле ниже (Ctrl+V).");
    }
  };

  useEffect(() => {
    setOrigin(window.location.origin);
    if (!fromExcel || tried.current) return;
    tried.current = true;
    void takeClipboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- один раз при открытии по кнопке из Excel
  }, []);

  // Разделитель аргументов формулы зависит от настроек Windows: в WPS с русскими настройками — «;».
  const [separator, setSeparator] = useState<";" | ",">(";");
  const formula = `=HYPERLINK("${origin}/import/excel?row="&${(columns.taskNumber || "B")}2${separator}"Отправить")`;
  const copyFormula = async () => {
    try {
      await navigator.clipboard.writeText(formula);
      setFormulaCopied(true);
    } catch {
      setFormulaCopied(false);
    }
  };

  /** Другой вид доставки или цена в окне проверки — пересчитать (ИИ заново не спрашиваем). */
  const choose = (next: ExcelRowChoice) =>
    run(async () => {
      if (!preview) return;
      const merged = { ...choice, ...next };
      setChoice(merged);
      setSaved(null);
      const result = await previewExcelRow(text, preview.found, merged);
      if (result.ok) setPreview(result.preview);
      else setError({ text: result.error, detail: result.detail });
    });

  const save = () =>
    run(async () => {
      if (!preview) return;
      const result = await saveExcelRow(text, preview.found, choice);
      if (result.ok) {
        setSaved(result);
        setError(null);
      } else setError({ text: result.error });
    });

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

            <h3 className="xr-subtitle">Вид доставки по тарифному плану</h3>
            <p className="xr-hint">
              Код из колонки «Тарифный план» строки (RU, PL, SEA…) → вид доставки посылки; по виду и стране получателя подбирается тариф.
              Пустой тарифный план — вид выбирается вручную в окне проверки.
            </p>
            <div className="xr-delivery">
              {deliveryRows.map((row, i) => (
                <div key={i} className="xr-delivery-row">
                  <input
                    className="xr-input xr-letter"
                    value={row.code}
                    onChange={(e) => setDeliveryRows((rows) => rows.map((r, j) => (j === i ? { ...r, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) } : r)))}
                    aria-label="Код тарифного плана"
                  />
                  <span className="xr-muted">→</span>
                  <select className="xr-input" value={row.type} onChange={(e) => setDeliveryRows((rows) => rows.map((r, j) => (j === i ? { ...r, type: e.target.value } : r)))} aria-label={`Вид доставки для ${row.code || "кода"}`}>
                    <option value="">выберите…</option>
                    {deliveryMethods.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
                  </select>
                  <button type="button" className="xr-btn" onClick={() => setDeliveryRows((rows) => rows.filter((_, j) => j !== i))} aria-label="Убрать код">×</button>
                </div>
              ))}
              <div className="xr-delivery-row">
                <span className="xr-delivery-rest">Остальные коды</span>
                <span className="xr-muted">→</span>
                <select className="xr-input" value={deliveryFallback} onChange={(e) => setDeliveryFallback(e.target.value)} aria-label="Вид доставки: остальные коды">
                  <option value="">выбирать вручную</option>
                  {deliveryMethods.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
                </select>
              </div>
            </div>
            <div className="xr-actions">
              <button type="button" className="xr-btn" onClick={() => setDeliveryRows((rows) => [...rows, { code: "", type: "" }])}>+ Код</button>
              <button type="button" className="xr-btn xr-btn--primary" onClick={saveDelivery} disabled={pending}>Сохранить виды доставки</button>
              {deliveryMessage && <span className={deliveryMessage.ok ? "xr-ok" : "xr-bad"}>{deliveryMessage.text}</span>}
            </div>
          </>
        ) : (
          columnsMessage && <p className={columnsMessage.ok ? "xr-ok" : "xr-bad"} style={{ margin: 0 }}>{columnsMessage.text}</p>
        )}
        {!fromExcel && (
          <div className="xr-formula">
            <b>Кнопка «Отправить» в Excel.</b> Скопируйте формулу (в ней уже адрес этой админки), вставьте в свободную колонку (например X)
            во второй строке листа и протяните вниз. Нажатие: щёлкните по номеру строки слева, Ctrl+C, затем «Отправить» — откроется эта страница со строкой.
            <div className="xr-actions" style={{ marginTop: 6 }}>
              <code className="xr-mono xr-code">{formula}</code>
              <button type="button" className="xr-btn" onClick={() => void copyFormula()}>
                <Copy size={13} /> {formulaCopied ? "Скопировано" : "Скопировать формулу"}
              </button>
              <label className="xr-check" title="Если WPS пишет об ошибке в формуле — попробуйте другой разделитель">
                Разделитель
                <select className="xr-input" value={separator} onChange={(e) => { setSeparator(e.target.value as ";" | ","); setFormulaCopied(false); }}>
                  <option value=";">; (точка с запятой)</option>
                  <option value=",">, (запятая)</option>
                </select>
              </label>
            </div>
          </div>
        )}
      </section>

      {!fromExcel && <ExcelFile columns={columns as ExcelColumns} />}

      <section className="card">
        <h2 className="card-title">Строка Excel{expected ? ` ${expected}` : ""}</h2>
        {fromExcel && (
          <div className="xr-from-excel">
            {clipboard ?? (preview || pending ? null : "Беру строку из скопированного…")}
            <button type="button" className="xr-btn" onClick={() => void takeClipboard()} disabled={pending}>
              <ClipboardPaste size={13} /> Вставить из буфера
            </button>
          </div>
        )}
        <p className="xr-hint">
          В Excel выделите строку начиная с колонки номера строки, нажмите Ctrl+C и вставьте сюда. Система покажет, что будет сохранено;
          в базу запись идёт только по кнопке «Сохранить в базу».
        </p>
        <textarea
          className="xr-input xr-text"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            // Открыто кнопкой из Excel и вставлена та самая строка — сразу разобрать.
            const value = e.clipboardData.getData("text");
            if (expected && pastedTask(value) === expected) {
              e.preventDefault();
              setText(value);
              setClipboard(null);
              check(value);
            }
          }}
          spellCheck={false}
        />
        <div className="xr-actions">
          <button type="button" className="xr-btn xr-btn--primary" onClick={() => check()} disabled={pending || !text.trim()}>
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
          {preview.recipientNew && !saved && (
            <p className="xr-new">
              Получателя <b>{preview.recipient.name}</b> нет у клиента {preview.client?.code} — при сохранении он будет создан из строки:
              ФИО, адрес, телефон, страна {preview.countryCode}. Проверьте ниже и сохраните; паспорт и остальное можно дополнить потом в «Получатели».
            </p>
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
                {preview.recipientMatch ? (
                  <span className="xr-ok">✓ есть у клиента</span>
                ) : preview.recipientNew ? (
                  <span className="xr-bad">новый — будет создан</span>
                ) : (
                  preview.client && <span className="xr-bad">нет у клиента</span>
                )}
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
              <dt>Вид доставки</dt>
              <dd>
                <select
                  className={`xr-input${preview.deliveryType ? "" : " xr-input--bad"}`}
                  value={choice.deliveryType ?? preview.deliveryType ?? ""}
                  onChange={(e) => choose({ deliveryType: e.target.value || null })}
                  disabled={pending}
                  aria-label="Вид доставки"
                >
                  {!preview.deliveryType && <option value="">выберите…</option>}
                  {preview.deliveryOptions.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
                </select>{" "}
                <span className="xr-muted">
                  {preview.tariffPlan
                    ? `тарифный план ${preview.tariffPlan}${preview.deliveryAuto.by === "default" ? " (остальные коды)" : ""}`
                    : "тарифный план пустой"}
                </span>
              </dd>
              <dt>Тариф</dt>
              <dd>
                {preview.tariff
                  ? <>{preview.tariff.direction} <span className="xr-muted">· {preview.tariff.perKgUsd} $/кг + {preview.tariff.feeUsd} $</span></>
                  : preview.deliveryType ? <span className="xr-bad">⚠ нет тарифа</span> : "—"}
              </dd>
              <dt>Вес</dt><dd>{preview.weightKg != null ? `${preview.weightKg} кг` : "—"}</dd>
              <dt>Стоимость товаров</dt><dd>{money(preview.goodsValueUsd, "$")}</dd>
              <dt>Отправка</dt>
              <dd>
                {money(preview.shippingUsd, "$")}{" "}
                {preview.priceCheck === "match" && <span className="xr-ok">✓ совпадает с тарифом</span>}
                {preview.priceCheck === "no-file" && <span className="xr-muted">по тарифу (в файле пусто)</span>}
                {preview.priceCheck === "no-tariff" && <span className="xr-muted">из файла</span>}
                {preview.priceCheck === "mismatch" && (
                  <span className="xr-price">
                    <span className="xr-bad">⚠ в файле {money(preview.fileShippingUsd, "$")}, по тарифу {money(preview.systemShippingUsd, "$")}</span>
                    <label className="xr-check">
                      <input type="radio" name="xr-price" checked={(choice.price ?? preview.priceSource) === "system"} onChange={() => choose({ price: "system" })} disabled={pending} />
                      цена системы {money(preview.systemShippingUsd, "$")}
                    </label>
                    <label className="xr-check">
                      <input type="radio" name="xr-price" checked={(choice.price ?? preview.priceSource) === "file"} onChange={() => choose({ price: "file" })} disabled={pending} />
                      цена файла {money(preview.fileShippingUsd, "$")}
                    </label>
                  </span>
                )}
              </dd>
              {preview.services.map((s) => (
                <span key={s.code} style={{ display: "contents" }}>
                  <dt>{s.name}</dt><dd>{s.code === "LOCAL_DELIVERY" ? money(s.cny, "¥") : money(s.usd, "$")}</dd>
                </span>
              ))}
              <dt>Итого, $</dt><dd>{money(preview.totalUsd, "$")}</dd>
              <dt>Курс</dt><dd>{preview.rate}{preview.rateFromRow ? "" : " (из настроек)"}</dd>
              {preview.dutyCny != null && (
                <><dt>Пошлина ЕС</dt><dd>{preview.euItemKinds} вид. × €3 = €{preview.dutyEur} × {preview.rateEur} = {money(preview.dutyCny, "¥")}</dd></>
              )}
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
                {saved.recipientCreated ? `, создан получатель ${saved.recipientCreated}` : ""}
                {saved.tracking ? ", ставится на слежение" : ""}
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
        .xr-subtitle { margin: 14px 0 4px; font-size: 13px; font-weight: 600; }
        .xr-delivery { display: flex; flex-direction: column; gap: 6px; }
        .xr-delivery-row { display: flex; align-items: center; gap: 8px; }
        .xr-delivery-rest { width: 52px; font-size: 12px; color: var(--color-muted); line-height: 1.2; }
        .xr-input--bad { border-color: var(--color-danger); }
        .xr-price { display: inline-flex; flex-direction: column; gap: 2px; }
        .xr-new { margin: 0 0 8px; padding: 8px 10px; background: var(--color-muted-bg); border-radius: 4px; line-height: 1.5; }
        .xr-formula { margin-top: 12px; padding: 8px 10px; background: var(--color-muted-bg); border-radius: 4px; line-height: 1.5; color: var(--color-text-secondary); }
        .xr-code { padding: 4px 8px; background: #fff; border: 1px solid var(--color-border); border-radius: 4px; font-size: 12px; word-break: break-all; }
        .xr-from-excel { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin: 0 0 8px; padding: 8px 10px; background: var(--color-warning-bg); border-radius: 4px; line-height: 1.45; }
        .xr-filters { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 8px; }
        .xr-chip { height: 26px; padding: 0 10px; border: 1px solid var(--color-border-strong); border-radius: 999px; background: #fff; font: inherit; font-size: 12.5px; cursor: pointer; }
        .xr-chip.is-active { border-color: var(--color-accent); background: var(--color-muted-bg); font-weight: 600; }
        .xr-file-list { max-height: 55dvh; overflow: auto; border: 1px solid var(--color-border); border-radius: 4px; }
        .xr-file-list th { position: sticky; top: 0; background: var(--color-surface); }
        .xr-check { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
        .xr-check input, .xr-table input[type="checkbox"] { margin: 0; accent-color: var(--color-accent); }
        .xr-spin { animation: xr-spin 0.8s linear infinite; }
        @keyframes xr-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
