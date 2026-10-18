// Окна (формы) админки — как формы в 1С: заголовок окна, командная панель с «Ещё» справа,
// шапка, страницы и подвал. Общий модуль для сервера и браузера: без обращения к базе.

export const FORM_PARTS = ["commands", "header", "pages", "footer"] as const;
export type FormPart = (typeof FORM_PARTS)[number];

export const FORM_PART_LABELS: Record<FormPart, string> = {
  commands: "Командная панель",
  header: "Шапка",
  pages: "Страницы",
  footer: "Подвал",
};

export const FORM_PART_HINTS: Record<FormPart, string> = {
  commands: "Кнопки окна и меню «Ещё». Есть всегда: в «Ещё» — «Изменить форму…».",
  header: "Отбор и поля над основной частью: поиск, период, реквизиты документа.",
  pages: "Основная часть окна: список, таблица или реквизиты.",
  footer: "Итоги и пояснения под основной частью.",
};

// Командную панель не скрыть — иначе не добраться до «Изменить форму…». Как в 1С: у неё галочка без флажка.
export const HIDEABLE_PARTS: FormPart[] = ["header", "pages", "footer"];

// hidden — скрытые части окна; widths — ширины столбцов таблиц окна в пикселях;
// columns — порядок и скрытые столбцы таблиц. Ключ столбца — «номер таблицы:заголовок»
// (components/form/columns.ts, column-widths.ts).
export type ColumnWidths = Record<string, number>;
export type ColumnLayout = { order?: string[]; hidden?: string[] };
export type FormSettings = { hidden: FormPart[]; widths?: ColumnWidths; columns?: ColumnLayout };
export type FormsSettings = Record<string, FormSettings>;

export const FORM_KEY_RE = /^[a-z0-9-]{1,40}$/;
export const MAX_FORMS = 200;
export const MAX_COLUMNS = 100;
export const COLUMN_KEY_MAX = 80;
export const COLUMN_MIN = 40;
export const COLUMN_MAX = 2000;

function normalizeWidths(raw: unknown): ColumnWidths | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const widths: ColumnWidths = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(widths).length >= MAX_COLUMNS) break;
    if (key.length > COLUMN_KEY_MAX || typeof value !== "number" || !Number.isFinite(value)) continue;
    widths[key] = Math.min(COLUMN_MAX, Math.max(COLUMN_MIN, Math.round(value)));
  }
  return Object.keys(widths).length ? widths : undefined;
}

function normalizeKeys(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const keys = [...new Set(raw.filter((key): key is string => typeof key === "string" && key.length <= COLUMN_KEY_MAX))];
  return keys.length ? keys.slice(0, MAX_COLUMNS) : undefined;
}

function normalizeColumns(raw: unknown): ColumnLayout | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const entry = raw as { order?: unknown; hidden?: unknown };
  const order = normalizeKeys(entry.order);
  const hidden = normalizeKeys(entry.hidden);
  if (!order && !hidden) return undefined;
  return { ...(order ? { order } : {}), ...(hidden ? { hidden } : {}) };
}

// Приводит сохранённое значение к допустимому: известные окна и части, без повторов, разумные ширины.
// Окно без настроек в результат не попадает.
export function normalizeForms(raw: unknown): FormsSettings {
  const result: FormsSettings = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return result;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!FORM_KEY_RE.test(key) || Object.keys(result).length >= MAX_FORMS) continue;
    const entry = (value ?? {}) as { hidden?: unknown; widths?: unknown; columns?: unknown };
    const list = Array.isArray(entry.hidden) ? entry.hidden : [];
    const hidden = HIDEABLE_PARTS.filter((part) => list.includes(part));
    const widths = normalizeWidths(entry.widths);
    const columns = normalizeColumns(entry.columns);
    if (hidden.length || widths || columns) {
      result[key] = { hidden, ...(widths ? { widths } : {}), ...(columns ? { columns } : {}) };
    }
  }
  return result;
}

// ── Меню «Ещё» — часть командной панели, как в 1С: в нём весь список команд окна.
// Сверху — кнопки самой панели (и те, что не поместились в строку), ниже — стандартные команды.
// Группы разделены чертой. Пункт работает, если у окна есть для него действие; остальные пока серые.
export const MORE_COMMAND_IDS = [
  "related",
  "copy",
  "edit",
  "delete",
  "refresh",
  "period",
  "post",
  "unpost",
  "findValue",
  "find",
  "cancelFind",
  "listSettings",
  "chooseSettings",
  "saveSettings",
  "defaultSettings",
  "outputList",
  "onechat",
  "guid",
  "changeHistory",
  "currencyCalc",
  "volumeCalc",
  "clearMismatch",
  "createBasedOn",
  "organizer",
  "editForm",
  "help",
] as const;
export type MoreCommandId = (typeof MORE_COMMAND_IDS)[number];

export type MoreCommand = { id: MoreCommandId; label: string; shortcut?: string; submenu?: boolean };

export const MORE_COMMANDS: MoreCommand[][] = [
  [
    { id: "related", label: "Связанные документы", shortcut: "Ctrl+Shift+S" },
    { id: "copy", label: "Скопировать", shortcut: "F9" },
    { id: "edit", label: "Изменить", shortcut: "F2" },
    { id: "delete", label: "Пометить на удаление / Снять пометку", shortcut: "Del" },
    { id: "refresh", label: "Обновить", shortcut: "F5" },
  ],
  [{ id: "period", label: "Установить период…" }],
  [
    { id: "post", label: "Провести" },
    { id: "unpost", label: "Отменить проведение" },
  ],
  [
    { id: "findValue", label: "Найти по текущему значению", shortcut: "Ctrl+Alt+F" },
    { id: "find", label: "Найти…", shortcut: "Ctrl+F" },
    { id: "cancelFind", label: "Отменить поиск", shortcut: "Ctrl+Q" },
  ],
  [
    { id: "listSettings", label: "Настроить список…" },
    { id: "chooseSettings", label: "Выбрать настройки…" },
    { id: "saveSettings", label: "Сохранить настройки…" },
    { id: "defaultSettings", label: "Установить стандартные настройки" },
  ],
  [
    { id: "outputList", label: "Вывести список…" },
    { id: "onechat", label: "OneChat" },
    { id: "guid", label: "{guid}" },
    { id: "changeHistory", label: "История изменений" },
    { id: "currencyCalc", label: "Калькулятор валют" },
    { id: "volumeCalc", label: "Калькулятор объемного веса" },
    { id: "clearMismatch", label: "Снять несоответствие" },
    { id: "createBasedOn", label: "Создать на основании", submenu: true },
    { id: "organizer", label: "Органайзер", submenu: true },
    { id: "editForm", label: "Изменить форму…" },
    { id: "help", label: "Справка", shortcut: "F1" },
  ],
];

// Параметры адреса, в которых окна держат строку поиска: «Отменить поиск» убирает их.
export const SEARCH_PARAMS = ["search", "track", "q"];
