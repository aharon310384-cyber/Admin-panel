// Строки покупки: площадки и ссылки. Общий модуль для сервера и браузера, без базы.
// Площадки — китайские сайты (не данные компании): по ним менеджер видит, где покупать; будущий автовыкуп — по ним же.

export const MARKETPLACES = [
  { code: "TAOBAO", label: "Taobao", hosts: ["taobao.com", "tb.cn"] },
  { code: "TMALL", label: "Tmall", hosts: ["tmall.com", "tmall.hk"] },
  { code: "1688", label: "1688", hosts: ["1688.com"] },
  { code: "WEIDIAN", label: "Weidian 微店", hosts: ["weidian.com", "vdian.com"] },
  { code: "PINDUODUO", label: "Pinduoduo", hosts: ["pinduoduo.com", "yangkeduo.com"] },
  { code: "POIZON", label: "Poizon", hosts: ["dewu.com", "poizon.com"] },
  { code: "JD", label: "JD", hosts: ["jd.com", "3.cn"] },
  { code: "WECHAT", label: "WeChat", hosts: [] },
  { code: "OTHER", label: "Другое", hosts: [] },
] as const;

export type MarketplaceCode = (typeof MARKETPLACES)[number]["code"];

export const marketplaceLabel = (code: string | null | undefined) => MARKETPLACES.find((m) => m.code === code)?.label ?? (code || "—");

export function isMarketplace(code: unknown): code is MarketplaceCode {
  return typeof code === "string" && MARKETPLACES.some((m) => m.code === code);
}

/** Площадка по ссылке; не узнали — «Другое». */
export function marketplaceOf(url: string | null | undefined): MarketplaceCode {
  if (!url) return "OTHER";
  let host = "";
  try {
    host = new URL(url).host.toLowerCase();
  } catch {
    return "OTHER";
  }
  const found = MARKETPLACES.find((m) => m.hosts.some((h) => host === h || host.endsWith(`.${h}`)));
  return found?.code ?? "OTHER";
}

/** Первая ссылка из текста: Taobao и 1688 при «Поделиться» дают текст со ссылкой внутри. */
export function firstLink(value: string): string | null {
  const match = value.match(/https?:\/\/[^\s<>"'，。）)】]+/i);
  if (!match) return null;
  try {
    const url = new URL(match[0]);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString().slice(0, 2000) : null;
  } catch {
    return null;
  }
}

export const shortHost = (url: string) => {
  try {
    return new URL(url).host.replace(/^(www|m|h5|item|detail)\./, "");
  } catch {
    return url.slice(0, 40);
  }
};
