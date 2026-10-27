// Загрузка списка клиентов из Excel: колонки файла, что меняется у клиента и что показать сотруднику до применения.
// Общий модуль для сервера и браузера. Разбор — lib/clients-file.ts, план и запись — actions/clients-import.ts.

/** Колонки файла по заголовку (без учёта регистра, «_» и «-» — как пробел). */
export const CLIENT_FILE_COLUMNS = {
  code: ["client_code", "code", "код", "код клиента"],
  lastName: ["last_name", "фамилия"],
  firstName: ["first_name", "имя"],
  middleName: ["middle_name", "отчество"],
  phone: ["phone", "телефон"],
  telegram: ["user_name", "username", "telegram", "телеграм"],
  email: ["e-mail", "email", "почта"],
  country: ["country", "страна"],
  city: ["city", "город"],
} satisfies Record<string, string[]>;

export type ClientFileField = keyof typeof CLIENT_FILE_COLUMNS;
export type ClientFileRow = { excelRow: number; values: Partial<Record<ClientFileField, string>> };

/** Поля клиента, которые меняет файл. */
export type ClientImportField = "name" | "lastName" | "firstName" | "middleName" | "phone" | "telegramUsername" | "email" | "country" | "city";

export const CLIENT_IMPORT_LABELS: Record<ClientImportField, string> = {
  name: "Имя в списке",
  lastName: "Фамилия",
  firstName: "Имя",
  middleName: "Отчество",
  phone: "Телефон",
  telegramUsername: "Telegram",
  email: "Email",
  country: "Страна",
  city: "Город",
};

/** new — новый клиент; update — изменится; same — без изменений; restore — был убран, вернётся; error — строка пропускается. */
export type ClientImportAction = "new" | "update" | "same" | "restore" | "error";
export type ClientImportChange = { field: ClientImportField; from: string | null; to: string };
export type ClientImportRow = {
  excelRow: number;
  code: string;
  name: string;
  action: ClientImportAction;
  changes: ClientImportChange[];
  notes: string[]; // что не так в строке и что система поправила: страна не из справочника, город по-английски…
};
/** Клиент есть в базе, а в файле его нет — «лишний»: можно убрать из списка. */
export type ClientNotInFile = { id: string; code: string | null; name: string; recipients: number; orders: number; parcels: number };
export type ClientsImportPlan = { rows: ClientImportRow[]; notInFile: ClientNotInFile[] };
