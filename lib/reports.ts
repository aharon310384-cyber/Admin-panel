// Кнопка «Отчёты» на командной панели окна — как в 1С: связки документов (заказ → задача → посылка → оплата)
// и другие отчёты. Здесь — какие отчёты есть у какого окна. Кнопка появляется у окна, когда у него есть хоть один отчёт;
// не поместилась в строку — остаётся в «Ещё» → «Отчёты». Общий модуль для сервера и браузера: без обращения к базе.

export type ReportLink = { label: string; href: string };

// Ключ — formKey окна (см. components/form/form.tsx), значение — отчёты окна; guid — идентификатор записи в карточке.
const REPORTS: Record<string, (guid?: string) => ReportLink[]> = {};

export function reportsFor(formKey: string, guid?: string): ReportLink[] {
  return REPORTS[formKey]?.(guid) ?? [];
}

// «Связанные документы» (Ctrl+Shift+S в «Ещё») — как в 1С: дерево документов вокруг записи окна.
// Ключ — formKey окна, значение — адрес окна связанных документов для записи guid; нет записи — пункт серый.
const RELATED: Record<string, (guid: string) => string> = {};

export function relatedDocumentsFor(formKey: string, guid?: string): string | null {
  return guid && RELATED[formKey] ? RELATED[formKey](guid) : null;
}
