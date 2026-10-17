// Кнопка «Отчёты» на командной панели окна — как в 1С: связки документов (заказ → задача → посылка → оплата)
// и другие отчёты. Здесь — какие отчёты есть у какого окна. Кнопка появляется у окна, когда у него есть хоть один отчёт;
// не поместилась в строку — остаётся в «Ещё» → «Отчёты». Общий модуль для сервера и браузера: без обращения к базе.

export type ReportLink = { label: string; href: string };

// Ключ — formKey окна (см. components/form/form.tsx), значение — отчёты окна; guid — идентификатор записи в карточке.
const REPORTS: Record<string, (guid?: string) => ReportLink[]> = {};

export function reportsFor(formKey: string, guid?: string): ReportLink[] {
  return REPORTS[formKey]?.(guid) ?? [];
}
