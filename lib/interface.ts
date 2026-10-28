// Панели интерфейса админки — как «Настройка панелей» в 1С.
// Общий модуль для сервера и браузера: без обращения к базе.
import {
  BookOpen,
  Building2,
  ClipboardList,
  CircleDollarSign,
  Globe,
  IdCard,
  ListChecks,
  Package,
  PackageCheck,
  Receipt,
  Settings,
  ShieldCheck,
  Sparkles,
  Tags,
  Truck,
  Users,
  Wallet,
  Warehouse,
  Workflow,
  BadgeDollarSign,
  type LucideIcon,
  FileSpreadsheet,
} from "lucide-react";

export const PANEL_CODES = ["sections", "functions", "open", "favorites", "history"] as const;
export type PanelCode = (typeof PANEL_CODES)[number];

export const PANEL_LABELS: Record<PanelCode, string> = {
  sections: "Панель разделов",
  functions: "Панель функций текущего раздела",
  open: "Панель открытых",
  favorites: "Панель избранного",
  history: "Панель истории",
};

export const PANEL_ZONES = ["top", "left", "right", "bottom"] as const;
export type PanelZone = (typeof PANEL_ZONES)[number];
// Зона — несколько групп панелей. Сверху и снизу группа — строка (панели в ней стоят рядом),
// слева и справа — столбец (панели в нём одна под другой). Как в «Редакторе панелей» 1С.
export type PanelGroup = PanelCode[];
export type PanelLayout = Record<PanelZone, PanelGroup[]>;

export const MAX_GROUPS = 5;
export const MAX_GROUP_SIZE = 5;

export function isVerticalZone(zone: PanelZone) {
  return zone === "left" || zone === "right";
}

// «Стандартные» — как в 1С: разделы сверху, открытые снизу, остальные не размещены.
export const DEFAULT_PANELS: PanelLayout = { top: [["sections"]], left: [], right: [], bottom: [["open"]] };

// Приводит сохранённое значение к допустимому: только известные панели, каждая не больше одного раза.
// Понимает и прежний формат, где зона — просто список панелей (каждая тогда отдельной строкой).
export function normalizePanels(raw: unknown): PanelLayout {
  if (!raw || typeof raw !== "object") return clonePanels(DEFAULT_PANELS);
  const seen = new Set<PanelCode>();
  const result: PanelLayout = { top: [], left: [], right: [], bottom: [] };
  for (const zone of PANEL_ZONES) {
    const list = (raw as Record<string, unknown>)[zone];
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const group: PanelGroup = [];
      for (const code of Array.isArray(entry) ? entry : [entry]) {
        if (PANEL_CODES.includes(code as PanelCode) && !seen.has(code as PanelCode) && group.length < MAX_GROUP_SIZE) {
          seen.add(code as PanelCode);
          group.push(code as PanelCode);
        }
      }
      if (group.length && result[zone].length < MAX_GROUPS) result[zone].push(group);
    }
  }
  return result;
}

export function clonePanels(layout: PanelLayout): PanelLayout {
  const copy = (groups: PanelGroup[]) => groups.map((group) => [...group]);
  return { top: copy(layout.top), left: copy(layout.left), right: copy(layout.right), bottom: copy(layout.bottom) };
}

export function placedPanels(layout: PanelLayout): Set<PanelCode> {
  return new Set(PANEL_ZONES.flatMap((zone) => layout[zone].flat()));
}

// ── Разделы (черновик, см. docs/product/отложено.md). Состав меняется здесь.
export type SectionItem = { href: string; label: string; icon: LucideIcon };
export type Section = { code: string; label: string; icon: LucideIcon; items: SectionItem[] };

export const SECTIONS: Section[] = [
  {
    code: "clients",
    label: "Клиенты",
    icon: Users,
    items: [
      { href: "/clients", label: "Клиенты", icon: IdCard },
      { href: "/recipients", label: "Получатели", icon: Users },
    ],
  },
  {
    code: "warehouse",
    label: "Склад",
    icon: Warehouse,
    items: [
      { href: "/orders", label: "Заказы", icon: ClipboardList },
      { href: "/receiving", label: "АРМ приём заказа", icon: PackageCheck },
      { href: "/tasks", label: "Задачи", icon: ListChecks },
      { href: "/parcels", label: "Посылки", icon: Package },
      { href: "/product-names", label: "Наименования товаров", icon: Tags },
      { href: "/import/excel", label: "Загрузка из Excel", icon: FileSpreadsheet },
    ],
  },
  {
    code: "logistics",
    label: "Логистика",
    icon: Truck,
    items: [
      { href: "/delivery-methods", label: "Виды доставки", icon: Truck },
      { href: "/countries", label: "Страны", icon: Globe },
      { href: "/tariffs", label: "Тарифы", icon: BadgeDollarSign },
    ],
  },
  {
    code: "finance",
    label: "Финансы",
    icon: Wallet,
    items: [
      { href: "/finance", label: "Курс", icon: CircleDollarSign },
      { href: "/payments", label: "Расчёт и оплата", icon: Receipt },
    ],
  },
  {
    code: "references",
    label: "Справочники",
    icon: BookOpen,
    items: [
      { href: "/statuses", label: "Статусы", icon: Workflow },
      { href: "/services", label: "Услуги", icon: Sparkles },
    ],
  },
  {
    code: "admin",
    label: "Администрирование",
    icon: ShieldCheck,
    items: [
      { href: "/settings", label: "Настройки", icon: Settings },
      { href: "/companies", label: "Компании", icon: Building2 },
    ],
  },
];

export function pathMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

// Раздел, в который входит страница (по самому длинному совпадению адреса).
export function sectionForPath(pathname: string): Section | undefined {
  let best: { section: Section; length: number } | undefined;
  for (const section of SECTIONS) {
    for (const item of section.items) {
      if (pathMatches(pathname, item.href) && (!best || item.href.length > best.length)) {
        best = { section, length: item.href.length };
      }
    }
  }
  return best?.section;
}

// ── Избранное и история: страницы, которые сотрудник открывал.
export type PageRef = { path: string; href: string; title: string };
export type Favorite = PageRef & { pinned?: boolean }; // pinned — «закреплено сверху»
export type HistoryEntry = PageRef & { at: string };

export const FAVORITES_LIMIT = 50;
export const HISTORY_LIMIT = 30;

function isPageRef(value: unknown): value is PageRef {
  if (!value || typeof value !== "object") return false;
  const { path, href, title } = value as Record<string, unknown>;
  return typeof path === "string" && typeof href === "string" && typeof title === "string";
}

export function normalizeFavorites(raw: unknown): Favorite[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isPageRef)
    .slice(0, FAVORITES_LIMIT)
    .map((item) => ({ path: item.path, href: item.href, title: item.title, ...((item as Favorite).pinned ? { pinned: true } : {}) }));
}

// Закреплённые — сверху, дальше в порядке добавления.
export function sortFavorites(favorites: Favorite[]): Favorite[] {
  return [...favorites.filter((item) => item.pinned), ...favorites.filter((item) => !item.pinned)];
}

export function normalizeHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is HistoryEntry => isPageRef(entry) && typeof (entry as HistoryEntry).at === "string")
    .slice(0, HISTORY_LIMIT)
    .map(({ path, href, title, at }) => ({ path, href, title, at }));
}
