import "server-only";

/**
 * ИИ-разбор свободного текста в черновики заказов.
 * Один заказ = один товар (+ кол-во, цена, трек). В одном тексте может быть
 * несколько товаров — модель распределяет их позаказно.
 * parseOrdersFromText — сообщение клиента (массовый ввод заказов);
 * parseExcelInfo — «большая ячейка» строки Excel: ещё и получатель, адрес, телефон.
 *
 * Провайдер: OpenRouter (OpenAI-совместимый API). Модель задаётся через env
 * OPENROUTER_ORDER_MODEL (по умолчанию свежая Kimi). Можно указать любой слаг
 * OpenRouter, напр. deepseek/deepseek-chat или moonshotai/kimi-k2.
 * OPENROUTER_API_URL подменяет адрес (проверка на заглушке).
 *
 * Юани в доллары переводит программа по переданному курсу (¥ за $), а не модель:
 * курс — из «Финансы → Курс» или из строки Excel.
 */

const OPENROUTER_URL = process.env.OPENROUTER_API_URL || "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "moonshotai/kimi-k2";

const DELIVERY_TYPES = ["AIR", "SEA", "TRAIN", "TRUCK"] as const;
type DeliveryType = (typeof DELIVERY_TYPES)[number];

export type ParsedOrderDraft = {
  productNameText: string;
  quantity: number;
  unitPriceUsd: number | null;
  unitPriceCny: number | null;
  trackNumber: string | null;
  customerComment: string | null;
  deliveryType: DeliveryType | null;
  recipientNameText: string | null;
  detailedCheckRequested: boolean;
  keepOriginalPackaging: boolean;
};

export type ParsedRecipient = {
  name: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  countryCode: string | null;
  phone: string | null;
};

function catalogBlock(catalog: string[]): string {
  return catalog.length
    ? `\n\nСПРАВОЧНИК НАИМЕНОВАНИЙ (используй ТОЧНО эти названия, если товар очевидно совпадает по смыслу — верни каноничное название из списка; если товара в списке нет — верни как есть):\n${catalog.map((n) => `- ${n}`).join("\n")}`
    : "";
}

const PRICE_RULES = `- ВАЛЮТА ЦЕНЫ. Внимательно определи валюту:
  • Если цена в юанях (¥, CNY, RMB, 元, «юаней», «юань», «ю», «китайских») — запиши число юаней в unitPriceCny, а unitPriceUsd = null. В доллары пересчитает программа.
  • Если цена в долларах ($, USD, «долларов», «баксов») — запиши в unitPriceUsd, а unitPriceCny = null.
  • Если валюта не указана — считай, что это доллары: unitPriceUsd = число, unitPriceCny = null.
  • Если цены нет вовсе — unitPriceUsd = null, unitPriceCny = null.
  Цена — за ЕДИНИЦУ товара. Если дана общая сумма за партию — раздели на quantity.`;

function buildSystemPrompt(catalog: string[]): string {
  return `Ты — помощник склада карго-доставки PostmanFox. Тебе дают свободный текст (сообщение клиента, выгрузку из Excel, список ссылок и т.п.), в котором может быть НЕСКОЛЬКО товаров-заказов. Твоя задача — разобрать текст и разложить его ПОЗАКАЗНО: один товар = один заказ.

Верни СТРОГО JSON-объект вида:
{"orders":[{"productNameText":"...","quantity":1,"unitPriceUsd":null,"unitPriceCny":null,"trackNumber":null,"customerComment":null,"deliveryType":null,"recipientNameText":null,"detailedCheckRequested":false,"keepOriginalPackaging":true}]}

Правила по полям:
- productNameText — наименование товара (строка, обязательно). Если в строке несколько одинаковых товаров — это один заказ с quantity.
- quantity — целое число, минимум 1. Если количество НЕ указано — всегда ставь 1.
${PRICE_RULES}
- trackNumber — китайский трек-номер посылки (строка) или null. НЕ путай с артикулом/SKU. У РАЗНЫХ трек-номеров — РАЗНЫЕ заказы.
- customerComment — комментарий/пожелания/примечания клиента к ЭТОМУ заказу (строка) или null. Сюда складывай всё, что относится к заказу, но НЕ раскладывается по остальным полям: номер/референс заказа клиента (например «#3661», «заказ 3661»), пожелания по упаковке или обработке словами («упаковать аккуратно», «позвонить перед отправкой», «хрупкое»), любые прочие заметки клиента. Если по товару таких заметок нет — null. Референс вроде «#3661» относится к товару(ам) рядом с ним; если товаров несколько под одним референсом — впиши его в каждый из этих заказов.
- deliveryType — одно из: "AIR" (авиа), "SEA" (море), "TRAIN" (ж/д), "TRUCK" (авто); либо null, если явно не указано.
- recipientNameText — имя/ФИО получателя (кому везём), если оно есть в тексте; иначе null.
- detailedCheckRequested — true, если клиент просит фотоотчёт, фото, детальную проверку, «проверьте», «сфотографируйте», «с фото»; иначе false.
- keepOriginalPackaging — по умолчанию true. Ставь false ТОЛЬКО если клиент явно просит компактную/лёгкую упаковку, убрать коробку, переупаковать, «без коробки», «выкинуть упаковку».
- Разные товары — разные элементы массива. Не объединяй разные товары в один заказ.
- Игнорируй приветствия и подписи. Адрес получателя игнорируй, но ИМЯ получателя вынеси в recipientNameText.
- Никакого текста вне JSON. Только JSON-объект.${catalogBlock(catalog)}`;
}

function buildExcelPrompt(catalog: string[]): string {
  return `Ты — помощник склада карго-доставки. Тебе дают содержимое «большой ячейки» из рабочего Excel-файла склада: одна строка файла — одна посылка клиента. В ячейке обычно: входящие трек-номера китайских служб доставки, товары (иногда с ценой), получатель, адрес, телефон, пожелания клиента. Разбери ячейку: товары — позаказно, получатель — отдельно.

Верни СТРОГО JSON-объект вида:
{"orders":[{"productNameText":"...","quantity":1,"unitPriceUsd":null,"unitPriceCny":null,"trackNumber":null,"customerComment":null,"deliveryType":null,"recipientNameText":null,"detailedCheckRequested":false,"keepOriginalPackaging":true}],"recipient":{"name":null,"address":null,"city":null,"postalCode":null,"countryCode":null,"phone":null}}

Правила по заказам (orders):
- Один товар = один заказ. Несколько входящих трек-номеров — это несколько заказов: у каждого заказа свой trackNumber. Если у одного трека несколько разных товаров — несколько заказов с одинаковым trackNumber. Если трек один, а товаров несколько — у всех этот трек.
- trackNumber — входящий трек-номер китайской службы (SF, JT, YT, ZTO, 京东 и т. п.) — точно как в тексте. НЕ путай с телефоном, артикулом, номером заказа клиента. Трек есть, а товар не назван — productNameText = "не указано".
- productNameText — наименование товара, обязательно. quantity — целое, минимум 1; не указано — 1.
${PRICE_RULES}
- customerComment — номер заказа клиента, пожелания по упаковке, прочие заметки к этому товару; нет — null.
- deliveryType — "AIR", "SEA", "TRAIN" или "TRUCK", если указано явно; иначе null.
- recipientNameText — ФИО получателя, если есть в тексте; иначе null.
- detailedCheckRequested — true, если просят фотоотчёт, фото, детальную проверку; иначе false.
- keepOriginalPackaging — по умолчанию true; false ТОЛЬКО если явно просят компактную упаковку, убрать коробку, переупаковать.

Правила по получателю (recipient):
- name, address, phone — копируй ТОЧНО как в тексте: не переводи, не переставляй слова, не исправляй.
- address — адрес доставки целиком, как в тексте (город и индекс тоже остаются в address).
- city, postalCode — город и почтовый индекс из адреса, если их можно выделить; иначе null.
- countryCode — страна получателя: двухбуквенный код ISO 3166-1 (UA, PL, MD, RU, DE, KZ, UZ и т. д.) по адресу или телефону; не понять — null.
- Получателя в тексте нет — все поля null.

Ничего не выдумывай: если чего-то нет в тексте — null. Никакого текста вне JSON.${catalogBlock(catalog)}`;
}

type ParseResult =
  | { ok: true; orders: ParsedOrderDraft[] }
  | { ok: false; error: string; detail?: string };

function coerceDraft(raw: unknown, rateCnyPerUsd: number): ParsedOrderDraft | null {
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
  // Юани в доллары переводит программа по курсу, а не модель.
  if (unitPriceCny != null) {
    unitPriceUsd = Math.round((unitPriceCny / rateCnyPerUsd) * 100) / 100;
  }

  const track = typeof o.trackNumber === "string" ? o.trackNumber.trim() : "";
  const trackNumber = track || null;

  const comment = typeof o.customerComment === "string" ? o.customerComment.trim() : "";
  const customerComment = comment || null;

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
    customerComment,
    deliveryType,
    recipientNameText,
    detailedCheckRequested,
    keepOriginalPackaging,
  };
}

type ModelAnswer = { ok: true; json: Record<string, unknown>; model: string } | { ok: false; error: string; detail?: string };

/** Спросить модель и получить JSON-объект ответа. */
async function askModel(systemPrompt: string, text: string, title: string): Promise<ModelAnswer> {
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
        "X-Title": title,
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
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "Модель вернула не объект", detail: `model=${model}\n\n${content.slice(0, 4000)}` };
  }
  return { ok: true, json: parsed as Record<string, unknown>, model };
}

function coerceOrders(json: Record<string, unknown>, model: string, rateCnyPerUsd: number): ParseResult {
  const ordersRaw = json.orders;
  if (!Array.isArray(ordersRaw)) {
    return {
      ok: false,
      error: "В ответе нет массива orders",
      detail: `model=${model}\n\nРазобранный JSON:\n${JSON.stringify(json, null, 2).slice(0, 4000)}`,
    };
  }

  const orders = ordersRaw
    .map((raw) => coerceDraft(raw, rateCnyPerUsd))
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

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function coerceRecipient(raw: unknown): ParsedRecipient | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const country = str(r.countryCode)?.toUpperCase() ?? null;
  const recipient: ParsedRecipient = {
    name: str(r.name),
    address: str(r.address),
    city: str(r.city),
    postalCode: str(r.postalCode),
    countryCode: country && /^[A-Z]{2}$/.test(country) ? country : null,
    phone: str(r.phone),
  };
  return Object.values(recipient).some(Boolean) ? recipient : null;
}

/** Сообщение клиента → черновики заказов. Курс — ¥ за $ из «Финансы → Курс». */
export async function parseOrdersFromText(
  text: string,
  catalog: string[],
  rateCnyPerUsd: number,
): Promise<ParseResult> {
  const answer = await askModel(buildSystemPrompt(catalog.slice(0, 400)), text, "PostmanFox Admin - order parser");
  if (!answer.ok) return answer;
  return coerceOrders(answer.json, answer.model, rateCnyPerUsd);
}

export type ExcelInfoResult =
  | { ok: true; orders: ParsedOrderDraft[]; recipient: ParsedRecipient | null; raw: unknown }
  | { ok: false; error: string; detail?: string };

/** «Большая ячейка» строки Excel → заказы и получатель. Курс — из строки Excel или из настроек. */
export async function parseExcelInfo(text: string, catalog: string[], rateCnyPerUsd: number): Promise<ExcelInfoResult> {
  const answer = await askModel(buildExcelPrompt(catalog.slice(0, 400)), text, "PostmanFox Admin - Excel row parser");
  if (!answer.ok) return answer;
  const orders = coerceOrders(answer.json, answer.model, rateCnyPerUsd);
  if (!orders.ok) return orders;
  return { ok: true, orders: orders.orders, recipient: coerceRecipient(answer.json.recipient), raw: answer.json };
}
