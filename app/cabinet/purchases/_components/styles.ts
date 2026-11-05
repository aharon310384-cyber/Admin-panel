// Стили страниц «Мои покупки» в кабинете клиента (префикс bk-). Цвета — переменные кабинета (--cab-*), бренд — из настроек компании.
export const PURCHASE_CABINET_CSS = `
  .bk { display: flex; flex-direction: column; gap: 14px; padding-bottom: 8px; }
  .bk-head { display: flex; align-items: center; gap: 10px; padding: 8px 4px 0; flex-wrap: wrap; }
  .bk-title { margin: 0; font-family: var(--font-space-grotesk), sans-serif; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }
  .bk-sub { margin: -6px 4px 0; font-size: 13px; color: var(--cab-muted); line-height: 1.45; }
  .bk-count { display: inline-flex; align-items: center; justify-content: center; min-width: 26px; height: 24px; padding: 0 8px; border-radius: 999px; font-size: 12.5px; font-weight: 700; color: var(--cab-green-deep); background: color-mix(in srgb, var(--cab-green) 14%, transparent); }
  .bk-spacer { flex: 1; }
  .bk-card { display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: var(--cab-radius-md); background: var(--cab-surface); border: 1px solid var(--cab-border); box-shadow: var(--cab-shadow-sm); }
  .bk-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .bk-num { font-family: var(--font-jetbrains-mono), monospace; font-size: 11.5px; color: var(--cab-muted); }
  .bk-name { margin: 2px 0 0; font-size: 15px; font-weight: 700; line-height: 1.3; word-break: break-word; }
  .bk-line { font-size: 12.5px; color: var(--cab-text-soft); line-height: 1.4; word-break: break-word; }
  .bk-line a { color: var(--cab-blue); }
  .bk-muted { color: var(--cab-muted); }
  .bk-hint { font-size: 12px; color: var(--cab-muted); line-height: 1.45; }
  .bk-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px 4px 8px; border-radius: 999px; font-size: 11.5px; font-weight: 600; white-space: nowrap; color: color-mix(in srgb, var(--pill) 72%, var(--cab-text)); background: color-mix(in srgb, var(--pill) 14%, transparent); border: 1px solid color-mix(in srgb, var(--pill) 26%, transparent); }
  .bk-pill::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--pill); }
  .bk-money { display: grid; grid-template-columns: 1fr auto; gap: 3px 12px; font-size: 13px; padding: 10px 12px; border-radius: var(--cab-radius-sm); background: color-mix(in srgb, var(--cab-green) 6%, var(--cab-surface)); }
  .bk-money span:nth-child(even) { text-align: right; font-variant-numeric: tabular-nums; }
  .bk-money .bk-total { font-weight: 700; font-size: 14.5px; }
  .bk-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .bk-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 11px 16px; border-radius: var(--cab-radius-sm); font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; text-decoration: none; border: 1px solid var(--cab-border); background: var(--cab-surface); color: var(--cab-text); transition: transform 0.14s ease, box-shadow 0.14s ease; }
  .bk-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: var(--cab-shadow-sm); }
  .bk-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .bk-btn--primary { color: #fff; border-color: transparent; background: linear-gradient(150deg, var(--cab-green) 0%, var(--cab-green-deep) 100%); box-shadow: 0 8px 20px color-mix(in srgb, var(--cab-green) 32%, transparent); }
  .bk-btn--ghost { font-weight: 600; color: var(--cab-muted); }
  .bk-btn--small { padding: 8px 12px; font-size: 13px; }
  .bk-balance { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px; border-radius: var(--cab-radius-md); background: linear-gradient(150deg, color-mix(in srgb, var(--cab-green) 16%, var(--cab-surface)), var(--cab-surface)); border: 1px solid var(--cab-border); box-shadow: var(--cab-shadow-sm); }
  .bk-balance-label { font-size: 12px; color: var(--cab-muted); font-weight: 600; }
  .bk-balance-value { font-family: var(--font-space-grotesk), sans-serif; font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .bk-ok, .bk-error, .bk-info { margin: 0; padding: 10px 12px; border-radius: var(--cab-radius-sm); font-size: 13px; line-height: 1.45; }
  .bk-ok { color: var(--cab-green-deep); background: color-mix(in srgb, var(--cab-green) 12%, transparent); }
  .bk-error { color: var(--cab-danger); background: color-mix(in srgb, var(--cab-danger) 10%, transparent); }
  .bk-info { color: var(--cab-text-soft); background: color-mix(in srgb, var(--cab-blue) 8%, transparent); white-space: pre-wrap; }
  .bk-form { display: flex; flex-direction: column; gap: 12px; }
  .bk-field { display: flex; flex-direction: column; gap: 5px; font-size: 13px; font-weight: 600; color: var(--cab-text-soft); }
  .bk-field small { font-weight: 400; color: var(--cab-muted); }
  .bk-field input, .bk-field select, .bk-field textarea { padding: 11px 12px; border-radius: var(--cab-radius-sm); border: 1px solid var(--cab-border-strong); background: var(--cab-surface); color: var(--cab-text); font: inherit; font-size: 15px; font-weight: 400; outline: none; }
  .bk-field input:focus, .bk-field select:focus, .bk-field textarea:focus { border-color: var(--cab-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--cab-green) 18%, transparent); }
  .bk-row { display: flex; gap: 10px; }
  .bk-row > * { flex: 1; min-width: 0; }
  .bk-row > .bk-qty { flex: 0 0 96px; }
  .bk-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 4px; border-radius: var(--cab-radius-sm); background: color-mix(in srgb, var(--cab-green) 7%, var(--cab-surface)); border: 1px solid var(--cab-border); }
  .bk-tab { padding: 10px; border-radius: 10px; border: none; background: none; font: inherit; font-size: 13.5px; font-weight: 700; color: var(--cab-text-soft); cursor: pointer; }
  .bk-tab--on { background: var(--cab-surface); color: var(--cab-green-deep); box-shadow: var(--cab-shadow-sm); }
  .bk-files { display: flex; flex-wrap: wrap; gap: 8px; }
  .bk-file { position: relative; width: 76px; height: 76px; border-radius: 12px; overflow: hidden; border: 1px solid var(--cab-border); background: var(--cab-bg); }
  .bk-file img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .bk-file button { position: absolute; top: 3px; right: 3px; width: 22px; height: 22px; border-radius: 50%; border: none; background: rgba(0,0,0,0.55); color: #fff; cursor: pointer; font-size: 13px; line-height: 1; }
  .bk-add { display: inline-flex; align-items: center; justify-content: center; flex-direction: column; gap: 3px; width: 76px; height: 76px; border-radius: 12px; border: 1.5px dashed var(--cab-border-strong); color: var(--cab-muted); font-size: 11px; font-weight: 600; cursor: pointer; text-align: center; }
  .bk-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .bk-moves { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .bk-moves li { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; padding: 9px 0; border-bottom: 1px solid var(--cab-border); font-size: 13px; }
  .bk-moves li:last-child { border-bottom: none; }
  .bk-plus { color: var(--cab-green-deep); font-weight: 700; font-variant-numeric: tabular-nums; }
  .bk-minus { color: var(--cab-text); font-weight: 700; font-variant-numeric: tabular-nums; }
  .bk-empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding: 36px 16px; border-radius: var(--cab-radius-md); background: var(--cab-surface); border: 1px solid var(--cab-border); }
  .bk-empty p { margin: 0; }
  .bk-h2 { margin: 6px 4px 0; font-size: 16px; font-weight: 700; }
  .bk-spin { animation: bk-spin 0.8s linear infinite; }
  @keyframes bk-spin { to { transform: rotate(360deg); } }
`;

/** Цвет статуса покупки и строки в кабинете. */
export const PURCHASE_PILL: Record<string, string> = {
  NEW: "var(--cab-blue)",
  PRICED: "var(--cab-orange)",
  PAID: "var(--cab-mint)",
  PURCHASED: "var(--cab-mint)",
  SHIPPED: "var(--cab-mint)",
  AT_WAREHOUSE: "var(--cab-green)",
  REJECTED: "var(--cab-danger)",
  CANCELED: "var(--cab-muted)",
  RETURNED: "var(--cab-muted)",
  PENDING: "var(--cab-orange)",
  CANCELED_TOPUP: "var(--cab-danger)",
};

// Корзина «Хочу купить» и карточки «Мои покупки».
export const PURCHASE_CART_CSS = `
  .pc-line { display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: var(--cab-radius-sm); border: 1px solid var(--cab-border-strong); background: color-mix(in srgb, var(--cab-green) 3%, var(--cab-surface)); }
  .pc-line-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .pc-line-head b { font-size: 13px; }
  .pc-remove { border: none; background: none; color: var(--cab-muted); font: inherit; font-size: 12.5px; cursor: pointer; }
  .pc-add { align-self: flex-start; }
  .pc-modes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .pc-mode { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: var(--cab-radius-sm); border: 1px solid var(--cab-border-strong); cursor: pointer; font-size: 13px; }
  .pc-mode--on { border-color: var(--cab-green); background: color-mix(in srgb, var(--cab-green) 8%, var(--cab-surface)); }
  .pc-mode small { display: block; color: var(--cab-muted); font-size: 11.5px; }
  .pc-services { display: flex; flex-direction: column; gap: 6px; }
  .pc-check { display: flex; gap: 8px; align-items: center; font-size: 13.5px; font-weight: 500; color: var(--cab-text-soft); cursor: pointer; }
  .pc-check small { color: var(--cab-muted); font-weight: 400; }
  .pc-est { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; font-size: 13px; }
  .pc-est span:nth-child(even) { text-align: right; font-variant-numeric: tabular-nums; }
  .pc-est .pc-sub { grid-column: 1 / -1; font-size: 11.5px; color: var(--cab-muted); margin-top: -2px; }
  .pc-est .pc-sum { font-weight: 700; font-size: 14.5px; padding-top: 6px; border-top: 1px solid var(--cab-border); }
  .pc-est .pc-approx { font-style: italic; color: var(--cab-text-soft); }
  .pc-need { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: var(--cab-radius-sm); background: color-mix(in srgb, var(--cab-orange) 10%, var(--cab-surface)); border: 1px solid color-mix(in srgb, var(--cab-orange) 26%, transparent); font-size: 13px; }
  .pc-need--calm { background: color-mix(in srgb, var(--cab-blue) 6%, var(--cab-surface)); border-color: color-mix(in srgb, var(--cab-blue) 18%, transparent); }
  .pc-facts { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; font-size: 12.5px; }
  .pc-facts dt { color: var(--cab-muted); }
  .pc-facts dd { margin: 0; }
  .pc-lines { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .pc-lines li { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; }
  .pc-lines .pc-st { font-size: 11.5px; color: var(--cab-muted); white-space: nowrap; }
`;
