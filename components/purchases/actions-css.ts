// Стили панелей действий карточки покупки и пополнения (префикс ba-).
export const ACTIONS_CSS = `
  .ba { display: flex; flex-direction: column; gap: 12px; }
  .ba-form { display: flex; flex-direction: column; gap: 8px; }
  .ba-form .card-title { margin: 0 0 2px; }
  .ba-row { display: flex; gap: 8px; }
  .ba-row > * { flex: 1; min-width: 0; }
  .ba-field { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; }
  .ba-field > span { color: var(--color-muted); }
  .ba-field--short { flex: 0 0 80px !important; }
  .ba-field input, .ba-field select, .ba-field textarea, .ba-in { padding: 7px 9px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font: inherit; font-size: 13.5px; background: var(--color-surface); color: var(--color-text); outline: none; width: 100%; box-sizing: border-box; }
  .ba-field input:focus, .ba-field select:focus, .ba-field textarea:focus, .ba-in:focus { border-color: var(--color-accent); }
  .ba-mono { font-family: var(--font-mono); }
  .ba-check { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
  .ba-services { display: flex; flex-direction: column; gap: 4px; }
  .ba-lines { display: flex; flex-direction: column; gap: 8px; }
  .ba-line { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 8px 10px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
  .ba-line legend { padding: 0 4px; font-size: 12px; color: var(--color-muted); }
  .ba-line:disabled { opacity: 0.65; }
  .ba-calc { display: flex; flex-direction: column; gap: 2px; font-size: 12.5px; color: var(--color-text-secondary); }
  .ba-total { margin: 2px 0; font-size: 14px; }
  .ba-hint { margin: 0; font-size: 12px; color: var(--color-muted); line-height: 1.45; }
  .ba-note { margin: 0; padding: 8px 10px; border-radius: var(--radius-sm); background: var(--color-muted-bg); color: var(--color-text-secondary); font-size: 13px; }
  .ba-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .ba-photo { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .ba-photo img { width: 48px; height: 48px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--color-border); }
  .ba-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 7px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text); font: inherit; font-size: 13px; cursor: pointer; white-space: nowrap; }
  .ba-btn:hover:not(:disabled) { background: var(--color-muted-bg); }
  .ba-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .ba-btn--primary { background: var(--color-accent); border-color: var(--color-accent); color: var(--color-accent-fg); }
  .ba-btn--primary:hover:not(:disabled) { background: var(--color-accent-hover); }
  .ba-btn--danger { color: var(--color-danger); }
  .ba-ok, .ba-error { margin: 0; padding: 8px 10px; border-radius: var(--radius-sm); line-height: 1.45; font-size: 13px; }
  .ba-ok { color: var(--color-success); background: var(--color-success-bg); }
  .ba-error { color: var(--color-danger); background: var(--color-warning-bg); }
  .ba-spin { animation: ba-spin 0.8s linear infinite; }
  @keyframes ba-spin { to { transform: rotate(360deg); } }
`;
