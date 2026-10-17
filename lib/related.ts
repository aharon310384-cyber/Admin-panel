// Кнопка «Связанные документы» на командной панели окна и тот же пункт в «Ещё» (Ctrl+Shift+S) — как в 1С.
// Здесь — у каких окон она есть. Общий модуль для сервера и браузера: без обращения к базе.

// Ключ — formKey окна, значение — адрес окна связанных документов для записи guid.
const RELATED: Record<string, (guid: string) => string> = {
  "order-edit": (id) => `/related/order/${id}`,
  parcel: (id) => `/related/parcel/${id}`,
};

export function relatedDocumentsFor(formKey: string, guid?: string): string | null {
  return guid && RELATED[formKey] ? RELATED[formKey](guid) : null;
}
