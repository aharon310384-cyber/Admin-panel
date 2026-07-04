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

/** Курс пересчёта юаня в доллар (¥ за $), совпадает с дефолтом в схеме Parcel. */
const CNY_PER_USD = 7.1;

const DELIVERY_TYPES = ["AUTO", "AIR", "SEA", "EMS"] as const;
type DeliveryType = (typeof DELIVERY_TYPES)[number];

export type ParsedOrderDraft = {
  productNameText: string;
  quantity: number;
  unitPriceUsd: number | null;
  unitPriceCny: number | null;
  trackNumber: string | null;
  deliveryType: DeliveryType | null;
  recipientNameText: string | null;
  detailedCheckRequested: boolean;
  keepOriginalPackaging: boolean;
};

function buildSystemPrompt(catalog: string[]): string {
  const catalogBlock = catalog.length
    ? `\n\nСПРАВОЧНИК НАИМЕНОВАНИЙ (используй ТОЧНО эти названия, если товар очевидно совпадает по смыслу — верни каноничное название из списка; если товара в списке нет — верни как есть):\n${catalog.map((n) => `- ${n}`).join("\n")}`
    : "";

  return `Ты — помощник склада карго-доставки PostmanFox. Тебе дают свободный текст (сообщение клиента, выгрузку из Excel, список ссылок и т.п.), в котором может быть НЕСКОЛЬКО товаров-заказов. Твоя задача — разобрать текст и разложить его ПОЗАКАЗНО: один товар = один заказ.

Верни СТРОГО JSON-объект вида:
{"orders":[{"productNameText":"...","quantity":1,"unitPriceUsd":null,"unitPriceCny":null,"trackNumber":null,"deliveryType":null,"recipientNameText":null,"detailedCheckRequested":false,"keepOriginalPackaging":true}]}

Правила по полям:
- productNameText — наименование товара (строка, обязательно). Если в строке несколько одинаковых товаров — это один заказ с quantity.
- quantity — целое число, минимум 1. Если количество НЕ указано — всегда ставь 1.
- ВАЛЮТА ЦЕНЫ. Внимательно определи валюту:
  • Если цена в юанях (¥, CNY, RMB, 元, «юаней», «юань», «ю», «китайских») — запиши число юаней в unitPriceCny И пересчитай в доллары: unitPriceUsd = round(unitPriceCny / ${CNY_PER_USD}, 2).
  • Если цена в долларах ($, USD, «долларов», «баксов») — запиши в unitPriceUsd, а unitPriceCny = null.
  • Если валюта не указана — считай, что это доллары: unitPriceUsd = число, unitPriceCny = null.
  • Если цены нет вовсе — unitPriceUsd = null, unitPriceCny = null.
  Цена — за ЕДИНИЦУ товара. Если дана общая сумма за партию — раздели на quantity.
- trackNumber — китайский трек-номер посылки (строка) или null. НЕ путай с артикулом/SKU. У РАЗНЫХ трек-номеров — РАЗНЫЕ заказы.
- deliveryType — одно из: "AUTO" (авто), "AIR" (авиа), "SEA" (море), "EMS"; либо null, если явно не указано.
- recipientNameText — имя/ФИО получателя (кому везём), если оно есть в тексте; иначе null.
- detailedCheckRequested — true, если клиент просит фотоотчёт, фото, детальную проверку, «проверьте», «сфотографируйте», «с фото»; иначе false.
- keepOriginalPackaging — по умолчанию true. Ставь false ТОЛЬКО если клиент явно просит компактную/лёгкую упаковку, убрать коробку, переупаковать, «без коробки», «выкинуть упаковку».
- Разные товары — разные элементы массива. Не объединяй разные товары в один заказ.
- Игнорируй приветствия и подписи. Адрес получателя игнорируй, но ИМЯ получателя вынеси в recipientNameText.
- Никакого текста вне JSON. Только JSON-объект.${catalogBlock}`;
}

type ParseResult =
  | { ok: true; orders: ParsedOrderDraft[] }
  | { ok: false; error: string; detail?: string };

function coerceDraft(raw: unknown): ParsedOrderDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const name = typeof o.productNameText === "string" ? o.productNameText.trim() : "";
  if (!name) return null;

  const qtyNum = Number(o.quantity);
  const quantity = Number.isFinite(qtyNum) && qtyNum >= 1 ? Math.floor(qtyNum) : 1;

  const cnyNum = Number(o.unitPriceCny);
  const unitPriceCny =
    o.unitPriceCny != null && Number.isFinite(cnyNum) && cnyNum >= 0
      ? Math.round(cnyNum * 100) / 100
      : null;

  const priceNum = Number(o.unitPriceUsd);
  let unitPriceUsd =
    o.unitPriceUsd != null && Number.isFinite(priceNum) && priceNum >= 0
      ? Math.round(priceNum * 100) / 100
      : null;
  // Страховка: если юани есть, а доллары модель не пересчитала — считаем сами.
  if (unitPriceUsd == null && unitPriceCny != null) {
    unitPriceUsd = Math.round((unitPriceCny / CNY_PER_USD) * 100) / 100;
  }

  const track = typeof o.trackNumber === "string" ? o.trackNumber.trim() : "";
  const trackNumber = track || null;

  const dt = typeof o.deliveryType === "string" ? o.deliveryType.toUpperCase() : "";
  const deliveryType = (DELIVERY_TYPES as readonly string[]).includes(dt)
    ? (dt as DeliveryType)
    : null;

  const recipient = typeof o.recipientNameText === "string" ? o.recipientNameText.trim() : "";
  const recipientNameText = recipient || null;

  const detailedCheckRequested = o.detailedCheckRequested === true;
  const keepOriginalPackaging = o.keepOriginalPackaging === false ? false : true;

  return {
    productNameText: name,
    quantity,
    unitPriceUsd,
    unitPriceCny,
    trackNumber,
    deliveryType,
    recipientNameText,
    detailedCheckRequested,
    keepOriginalPackaging,
  };
}

export async function parseOrdersFromText(
  text: string,
  catalog: string[] = [],
): Promise<ParseResult> {
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
  const systemPrompt = buildSystemPrompt(catalog.slice(0, 400));

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
        // ВНИМАНИЕ: НЕ передаём response_format=json_object. У moonshotai/kimi-k2
        // на OpenRouter НИ ОДИН провайдер не поддерживает structured-outputs
        // (с provider.require_parameters=true запрос падает в 404 "No endpoints",
        // без него провайдер вроде Novita отвечает 400 INVALID_REQUEST_BODY).
        // Поэтому полагаемся на строгий системный промпт ("верни СТРОГО JSON")
        // и на устойчивый разбор ответа ниже (снятие markdown-обёртки ```json).
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: trimmed },
        ],
      }),
    });
  } catch (err) {
    return {
      ok: false,
      error: "Не удалось связаться с OpenRouter",
      detail: `model=${model}\nurl=${OPENROUTER_URL}\n${String(err)}`,
    };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      error: `OpenRouter вернул ошибку ${res.status}`,
      detail: `model=${model}\nHTTP ${res.status} ${res.statusText}\n\n${body}`,
    };
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch (err) {
    return {
      ok: false,
      error: "OpenRouter вернул некорректный ответ",
      detail: `model=${model}\n${String(err)}`,
    };
  }

  const content = (payload as { choices?: { message?: { content?: string } }[] })
    ?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    return {
      ok: false,
      error: "Модель вернула пустой ответ",
      detail: `model=${model}\n\n${JSON.stringify(payload, null, 2).slice(0, 4000)}`,
    };
  }

  // Снимаем возможную markdown-обёртку ```json ... ``` — некоторые провайдеры
  // возвращают JSON внутри код-блока даже при response_format=json_object.
  const jsonText = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    return {
      ok: false,
      error: "Модель вернула не-JSON",
      detail: `model=${model}\n${String(err)}\n\nОтвет модели:\n${content.slice(0, 4000)}`,
    };
  }

  const ordersRaw = (parsed as { orders?: unknown })?.orders;
  if (!Array.isArray(ordersRaw)) {
    return {
      ok: false,
      error: "В ответе нет массива orders",
      detail: `model=${model}\n\nРазобранный JSON:\n${JSON.stringify(parsed, null, 2).slice(0, 4000)}`,
    };
  }

  const orders = ordersRaw
    .map(coerceDraft)
    .filter((d): d is ParsedOrderDraft => d !== null);

  if (orders.length === 0) {
    return {
      ok: false,
      error: "Не удалось распознать ни одного заказа",
      detail: `model=${model}\n\nМодель вернула orders, но ни одна строка не прошла проверку:\n${JSON.stringify(ordersRaw, null, 2).slice(0, 4000)}`,
    };
  }

  return { ok: true, orders };
}
