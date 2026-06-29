import "server-only";

/**
 * ИИ-разбор свободного текста в черновики заказов.
 * Один заказ = один товар (+ кол-во, цена, трек). В одном тексте может быть
 * несколько товаров — модель распределяет их позаказно.
 *
 * Провайдер: OpenRouter (OpenAI-совместимый API). Модель задаётся через env
 * OPENROUTER_ORDER_MODEL (по умолчанию свежая Kimi). Можно указать любой слаг
 * OpenRouter, напр. deepseek/deepseek-chat или moonshotai/kimi-k2.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "moonshotai/kimi-k2";

const DELIVERY_TYPES = ["AUTO", "AIR", "SEA", "EMS"] as const;
type DeliveryType = (typeof DELIVERY_TYPES)[number];

export type ParsedOrderDraft = {
  productNameText: string;
  quantity: number;
  unitPriceUsd: number | null;
  trackNumber: string | null;
  deliveryType: DeliveryType | null;
};

const SYSTEM_PROMPT = `Ты — помощник склада карго-доставки PostmanFox. Тебе дают свободный текст (сообщение клиента, выгрузку из Excel, список ссылок и т.п.), в котором может быть НЕСКОЛЬКО товаров-заказов. Твоя задача — разобрать текст и разложить его ПОЗАКАЗНО: один товар = один заказ.

Верни СТРОГО JSON-объект вида:
{"orders":[{"productNameText":"...","quantity":1,"unitPriceUsd":null,"trackNumber":null,"deliveryType":null}]}

Правила:
- productNameText — наименование товара (строка, обязательно). Если в строке несколько одинаковых товаров — это один заказ с quantity.
- quantity — целое число, минимум 1. Если не указано — 1.
- unitPriceUsd — цена за единицу в долларах США (число) или null, если не указана. Если цена в юанях (CNY/¥/RMB) — пересчитай в USD по курсу 7.1 (раздели на 7.1) и округли до 2 знаков.
- trackNumber — китайский трек-номер посылки (строка) или null. НЕ путай с артикулом/SKU.
- deliveryType — одно из: "AUTO" (авто), "AIR" (авиа), "SEA" (море), "EMS"; либо null, если не указано.
- Разные товары — разные элементы массива. Не объединяй разные товары в один заказ.
- Игнорируй приветствия, подписи, адреса получателя — только товары.
- Никакого текста вне JSON. Только JSON-объект.`;

type ParseResult =
  | { ok: true; orders: ParsedOrderDraft[] }
  | { ok: false; error: string };

function coerceDraft(raw: unknown): ParsedOrderDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const name = typeof o.productNameText === "string" ? o.productNameText.trim() : "";
  if (!name) return null;

  const qtyNum = Number(o.quantity);
  const quantity = Number.isFinite(qtyNum) && qtyNum >= 1 ? Math.floor(qtyNum) : 1;

  const priceNum = Number(o.unitPriceUsd);
  const unitPriceUsd =
    o.unitPriceUsd != null && Number.isFinite(priceNum) && priceNum >= 0
      ? Math.round(priceNum * 100) / 100
      : null;

  const track = typeof o.trackNumber === "string" ? o.trackNumber.trim() : "";
  const trackNumber = track || null;

  const dt = typeof o.deliveryType === "string" ? o.deliveryType.toUpperCase() : "";
  const deliveryType = (DELIVERY_TYPES as readonly string[]).includes(dt)
    ? (dt as DeliveryType)
    : null;

  return { productNameText: name, quantity, unitPriceUsd, trackNumber, deliveryType };
}

export async function parseOrdersFromText(text: string): Promise<ParseResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Не задан OPENROUTER_API_KEY в .env" };
  }
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Пустой текст" };
  if (trimmed.length > 12000) {
    return { ok: false, error: "Текст слишком длинный (макс. 12000 символов)" };
  }

  const model = process.env.OPENROUTER_ORDER_MODEL?.trim() || DEFAULT_MODEL;
  const referer = process.env.NEXT_PUBLIC_APP_URL || "https://cabinet.postmanfox.com";

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": referer,
        "X-Title": "PostmanFox Admin - order parser",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: trimmed },
        ],
      }),
    });
  } catch {
    return { ok: false, error: "Не удалось связаться с OpenRouter" };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `OpenRouter ${res.status}: ${body.slice(0, 200)}` };
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return { ok: false, error: "OpenRouter вернул некорректный ответ" };
  }

  const content = (payload as { choices?: { message?: { content?: string } }[] })
    ?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    return { ok: false, error: "Модель вернула пустой ответ" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, error: "Модель вернула не-JSON" };
  }

  const ordersRaw = (parsed as { orders?: unknown })?.orders;
  if (!Array.isArray(ordersRaw)) {
    return { ok: false, error: "В ответе нет массива orders" };
  }

  const orders = ordersRaw
    .map(coerceDraft)
    .filter((d): d is ParsedOrderDraft => d !== null);

  if (orders.length === 0) {
    return { ok: false, error: "Не удалось распознать ни одного заказа" };
  }

  return { ok: true, orders };
}
