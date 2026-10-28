// Документы окон для команд «Изменить», «Связанные документы» (Ctrl+Shift+S) и «История изменений» — как в 1С.
// В карточке документ — сама запись окна (guid), в списке — текущая строка (строки помечены data-doc, data-doc-id).
// Общий модуль для сервера и браузера: без обращения к базе.

export type DocEntity = "order" | "parcel" | "task";
export type DocTarget = { entity: DocEntity; id: string };

// history — у документов с версиями (lib/versions.ts); у задачи версий пока нет.
export const DOC_LINKS: Record<DocEntity, { open: (id: string) => string; related: (id: string) => string; history?: (id: string) => string }> = {
  order: {
    open: (id) => `/orders/${id}/edit`,
    related: (id) => `/related/order/${id}`,
    history: (id) => `/history/order/${id}`,
  },
  parcel: {
    open: (id) => `/parcels/${id}`,
    related: (id) => `/related/parcel/${id}`,
    history: (id) => `/history/parcel/${id}`,
  },
  task: {
    open: (id) => `/tasks/${id}`,
    related: (id) => `/related/task/${id}`,
  },
};

// Карточки документов: formKey окна → вид документа.
const CARDS: Record<string, DocEntity> = { "order-edit": "order", parcel: "parcel", task: "task" };

export function cardTarget(formKey: string, guid?: string): DocTarget | null {
  return guid && CARDS[formKey] ? { entity: CARDS[formKey], id: guid } : null;
}

export function isDocEntity(value: string | undefined): value is DocEntity {
  return value === "order" || value === "parcel" || value === "task";
}
