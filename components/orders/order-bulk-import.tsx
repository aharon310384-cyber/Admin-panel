"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Trash2, Plus, AlertTriangle, Copy, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { parseOrderText, createOrdersBulk, createRecipientQuick } from "@/actions/order-import";
import { soleDeliveryTypeForCountry } from "@/lib/postmanfox-tariffs";

type CustomerOpt = { id: string; code: string | null; name: string };
type RecipientOpt = { id: string; customerId: string; name: string; country: string | null };
type ProductNameOpt = { id: string; code: string; nameRu: string; category: string | null; hsCode: string | null };

type DeliveryValue = "" | "AUTO" | "AIR" | "SEA" | "EMS";

type Row = {
  productNameText: string;
  quantity: number;
  unitPriceUsd: number | null;
  unitPriceCny: number | null;
  trackNumber: string | null;
  detailedCheckRequested: boolean;
  keepOriginalPackaging: boolean;
};

const DELIVERY_OPTS: { value: DeliveryValue; label: string }[] = [
  { value: "", label: "—" },
  { value: "AUTO", label: "Авто" },
  { value: "AIR", label: "Авиа" },
  { value: "SEA", label: "Море" },
  { value: "EMS", label: "EMS" },
];

const norm = (s: string) => s.trim().toLowerCase();

function emptyRow(): Row {
  return {
    productNameText: "",
    quantity: 1,
    unitPriceUsd: null,
    unitPriceCny: null,
    trackNumber: null,
    detailedCheckRequested: false,
    keepOriginalPackaging: true,
  };
}

export default function OrderBulkImport({
  customers,
  recipients,
  productNames = [],
}: {
  customers: CustomerOpt[];
  recipients: RecipientOpt[];
  productNames?: ProductNameOpt[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryValue>("");
  const [recipientList, setRecipientList] = useState<RecipientOpt[]>(recipients);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null);
  const [pendingRecipient, setPendingRecipient] = useState<{ name: string; country: string } | null>(null);
  const [parsing, startParse] = useTransition();
  const [saving, startSave] = useTransition();
  const [creatingRecipient, startCreateRecipient] = useTransition();

  const customerRecipients = useMemo(
    () => recipientList.filter((r) => r.customerId === customerId),
    [recipientList, customerId],
  );

  const recipientCountry = useMemo(
    () => recipientList.find((r) => r.id === recipientId)?.country ?? null,
    [recipientList, recipientId],
  );

  const onParse = () => {
    setError(null);
    if (!text.trim()) {
      const message = "Вставьте текст заказа";
      toast.error(message);
      setError({ message });
      return;
    }
    startParse(async () => {
      const res = await parseOrderText(text);
      if (!res.ok) {
        toast.error(res.error);
        setError({ message: res.error, detail: res.detail });
        return;
      }

      // Получатель → клиент (пп. 5, 10): ищем получателя по имени во всём списке.
      let nextCustomerId = customerId;
      let nextRecipientId = recipientId;
      let country = recipientCountry;
      let pending: { name: string; country: string } | null = null;
      const recName = res.orders.map((o) => o.recipientNameText).find(Boolean) ?? null;
      if (recName) {
        const match = recipientList.find((r) => norm(r.name) === norm(recName));
        if (match) {
          nextCustomerId = match.customerId;
          nextRecipientId = match.id;
          country = match.country;
        } else {
          pending = { name: recName, country: "" };
        }
      }

      // Вид доставки (общий): приоритет — из текста, иначе единственный по стране.
      const sole = soleDeliveryTypeForCountry(country);
      const aiDelivery = res.orders.map((o) => o.deliveryType).find(Boolean) ?? null;
      const nextDelivery = (aiDelivery ?? sole ?? deliveryType) as DeliveryValue;

      const nextRows: Row[] = res.orders.map((o) => ({
        productNameText: o.productNameText,
        quantity: o.quantity,
        unitPriceUsd: o.unitPriceUsd,
        unitPriceCny: o.unitPriceCny,
        trackNumber: o.trackNumber,
        detailedCheckRequested: o.detailedCheckRequested,
        keepOriginalPackaging: o.keepOriginalPackaging,
      }));

      setCustomerId(nextCustomerId);
      setRecipientId(nextRecipientId);
      setDeliveryType(nextDelivery);
      setRows(nextRows);
      setPendingRecipient(pending);
      toast.success(`Распознано заказов: ${res.orders.length}`);
    });
  };

  const copyError = async () => {
    if (!error) return;
    const payload = error.detail ? `${error.message}\n\n${error.detail}` : error.message;
    try {
      await navigator.clipboard.writeText(payload);
      toast.success("Скопировано");
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  const onCustomerChange = (id: string) => {
    setCustomerId(id);
    setRecipientId("");
    setPendingRecipient(null);
  };

  const onRecipientChange = (id: string) => {
    setRecipientId(id);
    const country = recipientList.find((r) => r.id === id)?.country ?? null;
    const sole = soleDeliveryTypeForCountry(country);
    if (sole) setDeliveryType((prev) => prev || sole);
  };

  const onCreateRecipient = () => {
    if (!pendingRecipient) return;
    if (!customerId) {
      toast.error("Сначала выберите клиента для получателя");
      return;
    }
    startCreateRecipient(async () => {
      const res = await createRecipientQuick({
        customerId,
        name: pendingRecipient.name,
        country: pendingRecipient.country || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const created: RecipientOpt = res.recipient;
      setRecipientList((prev) => [...prev, created]);
      setRecipientId(created.id);
      setPendingRecipient(null);
      const sole = soleDeliveryTypeForCountry(created.country);
      if (sole) setDeliveryType((prev) => prev || sole);
      toast.success(`Получатель создан: ${created.name}`);
    });
  };

  const updateRow = (i: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const removeRow = (i: number) => {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  };
  const addRow = () => {
    setRows((prev) => [...prev, emptyRow()]);
  };

  const matchedName = (value: string) => {
    const t = norm(value);
    return t ? productNames.find((p) => norm(p.nameRu) === t) ?? null : null;
  };

  const onSave = () => {
    if (!customerId) {
      toast.error("Выберите клиента");
      return;
    }
    if (rows.length === 0) {
      toast.error("Добавьте хотя бы один заказ");
      return;
    }
    if (rows.some((r) => !r.productNameText.trim())) {
      toast.error("У каждого заказа должно быть наименование");
      return;
    }
    startSave(async () => {
      const res = await createOrdersBulk({
        customerId,
        recipientId: recipientId || null,
        deliveryType: deliveryType || null,
        orders: rows.map((r) => ({
          productNameText: r.productNameText,
          quantity: r.quantity,
          unitPriceUsd: r.unitPriceUsd,
          unitPriceCny: r.unitPriceCny,
          trackNumber: r.trackNumber,
          detailedCheckRequested: r.detailedCheckRequested,
          keepOriginalPackaging: r.keepOriginalPackaging,
        })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Создано заказов: ${res.created}`);
      router.push("/orders");
      router.refresh();
    });
  };

  return (
    <section className="bi">
      <div className="bi-head">
        <span className="bi-icon"><Sparkles size={16} /></span>
        <div>
          <h2 className="bi-title">ИИ-разбор заказов</h2>
          <p className="bi-sub">Вставьте список товаров одним текстом — ИИ разложит его по заказам и заполнит поля ниже</p>
        </div>
      </div>

      <textarea
        className="bi-textarea"
        placeholder={"Например:\nИванов Иван. Куртка зимняя, 2 шт, 250¥, трек YT1234567890CN, с фотоотчётом\nКроссовки Nike 42, 280¥, трек SF987654321CN"}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
      />

      <div className="bi-actions">
        <button type="button" className="bi-parse" onClick={onParse} disabled={parsing}>
          {parsing ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
          {parsing ? "Разбираю…" : "Разобрать"}
        </button>
      </div>

      {error && (
        <div className="bi-error" role="alert">
          <div className="bi-error-head">
            <AlertTriangle size={15} className="bi-error-ic" />
            <span className="bi-error-msg">{error.message}</span>
            <button type="button" className="bi-error-copy" onClick={copyError}>
              <Copy size={13} /> Скопировать
            </button>
          </div>
          {error.detail && <pre className="bi-error-log">{error.detail}</pre>}
        </div>
      )}

      <div className="bi-result">
        <div className="bi-assign">
          <label className="bi-field">
            <span className="bi-label">Клиент <i>*</i></span>
            <select className="bi-input" value={customerId} onChange={(e) => onCustomerChange(e.target.value)}>
              <option value="">— выберите —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.code ? `${c.code} · ` : ""}{c.name}</option>
              ))}
            </select>
          </label>
          <label className="bi-field">
            <span className="bi-label">Получатель</span>
            <select className="bi-input" value={recipientId} onChange={(e) => onRecipientChange(e.target.value)} disabled={!customerId}>
              <option value="">— не выбран —</option>
              {customerRecipients.map((r) => (
                <option key={r.id} value={r.id}>{r.name}{r.country ? ` · ${r.country}` : ""}</option>
              ))}
            </select>
          </label>
          <label className="bi-field">
            <span className="bi-label">Вид доставки</span>
            <select className="bi-input" value={deliveryType} onChange={(e) => setDeliveryType(e.target.value as DeliveryValue)}>
              {DELIVERY_OPTS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>

        {pendingRecipient && (
          <div className="bi-newrec">
            <div className="bi-newrec-head">
              <UserPlus size={15} className="bi-newrec-ic" />
              <span>Получатель «{pendingRecipient.name}» не найден — создать?</span>
              <button type="button" className="bi-newrec-close" onClick={() => setPendingRecipient(null)} aria-label="Отмена">
                <X size={14} />
              </button>
            </div>
            <div className="bi-newrec-grid">
              <label className="bi-field">
                <span className="bi-label">Имя получателя <i>*</i></span>
                <input className="bi-input" value={pendingRecipient.name} onChange={(e) => setPendingRecipient({ ...pendingRecipient, name: e.target.value })} />
              </label>
              <label className="bi-field">
                <span className="bi-label">Страна</span>
                <input className="bi-input" value={pendingRecipient.country} onChange={(e) => setPendingRecipient({ ...pendingRecipient, country: e.target.value })} placeholder="напр. Казахстан" />
              </label>
            </div>
            <div className="bi-newrec-actions">
              {!customerId && <span className="bi-newrec-hint">Сначала выберите клиента</span>}
              <button type="button" className="bi-newrec-save" onClick={onCreateRecipient} disabled={creatingRecipient || !customerId || !pendingRecipient.name.trim()}>
                {creatingRecipient ? <Loader2 size={14} className="spin" /> : <UserPlus size={14} />}
                Создать получателя
              </button>
            </div>
          </div>
        )}

        <div className="bi-rows">
          {rows.map((r, i) => {
            const matched = matchedName(r.productNameText);
            const declared = (r.unitPriceUsd ?? 0) * (r.quantity || 0);
            return (
              <div className="bi-row" key={i}>
                <div className="bi-row-head">
                  <span className="bi-row-num">Заказ {i + 1}</span>
                  <button type="button" className="bi-del" onClick={() => removeRow(i)} aria-label="Удалить заказ">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="bi-row-grid">
                  <label className="bi-field bi-field--wide">
                    <span className="bi-label">Наименование <i>*</i></span>
                    <input
                      className="bi-input"
                      value={r.productNameText}
                      onChange={(e) => updateRow(i, { productNameText: e.target.value })}
                      placeholder="Начните вводить — выбор из справочника"
                      list="pn-list-bulk"
                      autoComplete="off"
                    />
                    {matched ? (
                      <span className="bi-hint bi-hint--ok">Из справочника · {matched.category ?? "без секции"}{matched.hsCode ? ` · HS ${matched.hsCode}` : ""}</span>
                    ) : r.productNameText.trim() ? (
                      <span className="bi-hint bi-hint--muted">Свободный ввод (нет в справочнике)</span>
                    ) : null}
                  </label>
                  <label className="bi-field bi-field--wide">
                    <span className="bi-label">Трек-номер (Китай)</span>
                    <input className="bi-input bi-input--mono" value={r.trackNumber ?? ""} onChange={(e) => updateRow(i, { trackNumber: e.target.value || null })} placeholder="SF…" />
                  </label>
                  <label className="bi-field">
                    <span className="bi-label">Количество <i>*</i></span>
                    <input className="bi-input" type="number" min={1} value={r.quantity} onChange={(e) => updateRow(i, { quantity: Number(e.target.value) || 1 })} />
                  </label>
                  <label className="bi-field">
                    <span className="bi-label">Цена за ед., $</span>
                    <input className="bi-input" type="number" min={0} step="0.01" value={r.unitPriceUsd ?? ""} onChange={(e) => updateRow(i, { unitPriceUsd: e.target.value === "" ? null : Number(e.target.value) })} placeholder="0.00" />
                    {r.unitPriceCny != null && <span className="bi-hint bi-hint--muted">≈ {r.unitPriceCny}¥ по курсу 7.1</span>}
                  </label>
                  <div className="bi-field bi-row-total">
                    <span className="bi-label">Итого стоимость товаров</span>
                    <div className="bi-row-total-box">
                      <span className="bi-row-total-val">{declared ? `$${declared.toFixed(2)}` : "—"}</span>
                      <span className="bi-row-total-hint">цена × количество</span>
                    </div>
                  </div>
                </div>

                <div className="bi-services">
                  <span className="bi-services-title">Доп. услуги</span>
                  <div className="bi-checks">
                    <label className="bi-check">
                      <input type="checkbox" checked={r.detailedCheckRequested} onChange={(e) => updateRow(i, { detailedCheckRequested: e.target.checked })} />
                      <span>Детальная проверка и фотоотчёт</span>
                    </label>
                    <label className="bi-check">
                      <input type="checkbox" checked={r.keepOriginalPackaging} onChange={(e) => updateRow(i, { keepOriginalPackaging: e.target.checked })} />
                      <span>Оставить оригинальную упаковку</span>
                    </label>
                  </div>
                </div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <div className="bi-empty">Нет заказов — добавьте вручную или разберите текст</div>
          )}
        </div>

        <datalist id="pn-list-bulk">
          {productNames.map((p) => (
            <option key={p.id} value={p.nameRu}>
              {p.code}{p.hsCode ? ` · HS ${p.hsCode}` : ""}
            </option>
          ))}
        </datalist>

        <div className="bi-foot">
          <button type="button" className="bi-add" onClick={addRow}>
            <Plus size={15} /> Добавить заказ
          </button>
          <button type="button" className="bi-save" onClick={onSave} disabled={saving || rows.length === 0}>
            {saving ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
            {saving ? "Создаю…" : `Создать все (${rows.length})`}
          </button>
        </div>
      </div>

      <style>{`
        .bi { display: flex; flex-direction: column; gap: 14px; padding: 20px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); }
        .bi-head { display: flex; align-items: center; gap: 12px; }
        .bi-icon { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; color: var(--color-accent); background: oklch(52% 0.14 42 / 0.1); flex-shrink: 0; }
        .bi-title { margin: 0; font-size: 16px; font-weight: 700; color: var(--color-text); }
        .bi-sub { margin: 2px 0 0; font-size: 12.5px; color: var(--color-muted); }
        .bi-textarea { width: 100%; padding: 12px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13.5px; font-family: var(--font-sans); color: var(--color-text); background: var(--color-surface); resize: vertical; outline: none; transition: border-color 0.15s; }
        .bi-textarea:focus { border-color: var(--color-accent); }
        .bi-actions { display: flex; }
        .bi-parse { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; border: 1px solid var(--color-accent); border-radius: var(--radius-sm); background: var(--color-accent); color: var(--color-accent-fg); font-size: 13.5px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
        .bi-parse:hover { opacity: 0.9; }
        .bi-parse:disabled { opacity: 0.6; cursor: not-allowed; }

        .bi-error { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border: 1px solid color-mix(in oklch, var(--color-danger) 45%, var(--color-border)); border-radius: var(--radius-sm); background: color-mix(in oklch, var(--color-danger) 8%, var(--color-surface)); }
        .bi-error-head { display: flex; align-items: center; gap: 8px; }
        .bi-error-ic { color: var(--color-danger); flex-shrink: 0; }
        .bi-error-msg { font-size: 13px; font-weight: 600; color: var(--color-danger); }
        .bi-error-copy { display: inline-flex; align-items: center; gap: 5px; margin-left: auto; padding: 5px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-muted); font-size: 12px; font-weight: 600; cursor: pointer; transition: color 0.15s, border-color 0.15s; }
        .bi-error-copy:hover { color: var(--color-text); border-color: var(--color-accent); }
        .bi-error-log { margin: 0; padding: 10px 12px; max-height: 260px; overflow: auto; border-radius: var(--radius-sm); background: var(--color-muted-bg); border: 1px solid var(--color-border); font-family: var(--font-mono); font-size: 11.5px; line-height: 1.5; color: var(--color-text); white-space: pre-wrap; word-break: break-word; }

        .bi-result { display: flex; flex-direction: column; gap: 14px; padding-top: 4px; border-top: 1px solid var(--color-border); }
        .bi-assign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .bi-field { display: flex; flex-direction: column; gap: 5px; }
        .bi-field--wide { grid-column: 1 / -1; }
        .bi-label { font-size: 12px; font-weight: 600; color: var(--color-muted); }
        .bi-label i { color: var(--color-danger); font-style: normal; }
        .bi-input { padding: 9px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13.5px; color: var(--color-text); background: var(--color-surface); outline: none; transition: border-color 0.15s; }
        .bi-input:focus { border-color: var(--color-accent); }
        .bi-input--mono { font-family: var(--font-mono); font-size: 12.5px; }
        .bi-hint { font-size: 11.5px; }
        .bi-hint--ok { color: var(--color-status-completed); }
        .bi-hint--muted { color: var(--color-muted); }

        .bi-newrec { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border: 1px solid color-mix(in oklch, var(--color-accent) 40%, var(--color-border)); border-radius: var(--radius-sm); background: color-mix(in oklch, var(--color-accent) 6%, var(--color-surface)); }
        .bi-newrec-head { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--color-text); }
        .bi-newrec-ic { color: var(--color-accent); flex-shrink: 0; }
        .bi-newrec-close { margin-left: auto; display: inline-flex; padding: 4px; border: none; background: transparent; color: var(--color-muted); cursor: pointer; border-radius: var(--radius-sm); }
        .bi-newrec-close:hover { color: var(--color-danger); }
        .bi-newrec-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .bi-newrec-actions { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
        .bi-newrec-hint { font-size: 12px; color: var(--color-danger); }
        .bi-newrec-save { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border: 1px solid var(--color-accent); border-radius: var(--radius-sm); background: var(--color-accent); color: var(--color-accent-fg); font-size: 13px; font-weight: 600; cursor: pointer; }
        .bi-newrec-save:disabled { opacity: 0.6; cursor: not-allowed; }

        .bi-rows { display: flex; flex-direction: column; gap: 12px; }
        .bi-row { border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 14px; background: color-mix(in oklch, var(--color-muted-bg) 35%, var(--color-surface)); }
        .bi-row-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .bi-row-num { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-accent); }
        .bi-row-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .bi-del { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-muted); cursor: pointer; transition: color 0.15s, border-color 0.15s; }
        .bi-del:hover { color: var(--color-danger); border-color: color-mix(in oklch, var(--color-danger) 40%, transparent); }

        .bi-row-total { display: flex; flex-direction: column; gap: 5px; }
        .bi-row-total-box { display: flex; align-items: baseline; gap: 8px; padding: 8px 12px; border-radius: var(--radius-sm); background: var(--color-surface); border: 1px solid var(--color-border); }
        .bi-row-total-val { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--color-text); }
        .bi-row-total-hint { font-size: 11px; color: var(--color-muted); margin-left: auto; }

        .bi-services { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border); }
        .bi-services-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); }
        .bi-checks { display: flex; flex-direction: column; gap: 10px; }
        .bi-check { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--color-text); cursor: pointer; }
        .bi-check input { width: 15px; height: 15px; accent-color: var(--color-accent); cursor: pointer; }
        .bi-empty { text-align: center; padding: 18px; color: var(--color-muted); border: 1px dashed var(--color-border); border-radius: var(--radius-sm); }

        .bi-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .bi-add { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border: 1px dashed var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text); font-size: 13px; font-weight: 600; cursor: pointer; transition: border-color 0.15s; }
        .bi-add:hover { border-color: var(--color-accent); color: var(--color-accent); }
        .bi-save { display: inline-flex; align-items: center; gap: 7px; padding: 10px 20px; border: none; border-radius: var(--radius-sm); background: var(--color-accent); color: var(--color-accent-fg); font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
        .bi-save:hover { opacity: 0.9; }
        .bi-save:disabled { opacity: 0.6; cursor: not-allowed; }

        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 640px) { .bi-assign, .bi-row-grid, .bi-newrec-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
