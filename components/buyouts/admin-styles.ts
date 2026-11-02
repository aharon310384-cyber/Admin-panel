// Общие стили экранов выкупа и пополнений в админке (журналы, карточки, формы): префикс bo-.
export const BUYOUT_ADMIN_CSS = `
  .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); }
  .card--pad { padding: 12px 14px; font-size: 13.5px; }
  .card-title { margin: 0 0 10px; font-size: 14px; font-weight: 600; }
  .card a { color: var(--color-accent); text-decoration: none; }
  .card a:hover { text-decoration: underline; }
  .table-wrap { overflow-x: auto; }
  .table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  .table--wide { min-width: 1100px; }
  .table th { text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
  .table td { padding: 10px 14px; border-bottom: 1px solid var(--color-border); color: var(--color-text); white-space: nowrap; }
  .table tbody tr:last-child td { border-bottom: none; }
  .table tbody tr:hover td { background: var(--color-muted-bg); }
  .table tr.is-deleted td { color: var(--color-muted); text-decoration: line-through; }
  .table-empty { text-align: center; padding: 40px 16px !important; color: var(--color-muted); }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .clip { max-width: 280px; overflow: hidden; text-overflow: ellipsis; }
  .strong { font-weight: 600; }
  .mono { font-family: var(--font-mono); font-size: 12px; }
  .muted { color: var(--color-muted); font-weight: 400; }
  .pre { white-space: pre-wrap; }
  .code-pill { display: inline-flex; min-width: 36px; justify-content: center; padding: 2px 7px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 11.5px; font-weight: 600; background: var(--color-muted-bg); color: var(--color-text); }
  .st { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600; white-space: nowrap; }
  .st--new { color: var(--color-status-new); background: var(--color-status-new-bg); }
  .st--processing { color: var(--color-status-processing); background: var(--color-status-processing-bg); }
  .st--assembled { color: var(--color-status-assembled); background: var(--color-status-assembled-bg); }
  .st--ready { color: var(--color-status-ready); background: var(--color-status-ready-bg); }
  .st--shipped { color: var(--color-status-shipped); background: var(--color-status-shipped-bg); }
  .st--completed { color: var(--color-status-completed); background: var(--color-status-completed-bg); }
  .st--canceled { color: var(--color-status-canceled); background: var(--color-status-canceled-bg); }
  .st--utilized { color: var(--color-status-utilized); background: var(--color-status-utilized-bg); }
  .bo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 12px; align-items: start; }
  .bo-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .bo-dl { margin: 0; display: grid; grid-template-columns: minmax(140px, auto) 1fr; gap: 6px 14px; }
  .bo-dl dt { color: var(--color-muted); }
  .bo-dl dd { margin: 0; word-break: break-word; }
  .bo-money td { padding: 5px 0; border: none; }
  .bo-money td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
  .bo-money tr.total td { border-top: 1px solid var(--color-border); font-weight: 700; padding-top: 8px; }
  .bo-files { display: flex; flex-wrap: wrap; gap: 8px; }
  .bo-files a { display: block; width: 96px; height: 96px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow: hidden; background: var(--color-muted-bg); }
  .bo-files img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .bo-history { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .bo-history li { display: grid; grid-template-columns: 130px 1fr; gap: 10px; }
  .bo-warn { margin: 8px 0 0; padding: 8px 10px; border-radius: var(--radius-sm); color: var(--color-warning); background: var(--color-warning-bg); }
`;
