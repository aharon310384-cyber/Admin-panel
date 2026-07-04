import type { Metadata } from "next";
import Link from "next/link";
import {
  Calculator,
  Camera,
  Layers,
  PackageOpen,
  Pencil,
  Plus,
  Shield,
  Sparkles,
  Trash2,
} from "lucide-react";
import SortableHeader from "@/components/ui/sortable-header";
import { parseSortParam, buildListHref } from "@/lib/list-params";

export const metadata: Metadata = { title: "Услуги" };

type PricingType = "fixed" | "percent" | "perUnit" | "perKg";
type ServiceCurrency = "USD" | "CNY";

type MockService = {
  id: string;
  code: string;
  nameRu: string;
  nameEn: string;
  description: string;
  pricingType: PricingType;
  value: number;
  currency: ServiceCurrency | null;
  applicableDeliveryTypes: string[];
  isActive: boolean;
  sortOrder: number;
  icon: typeof Shield;
};

// Mock-данные для макета. Реальные таблицы появятся на шаге 2-3.
const SERVICES: MockService[] = [
  {
    id: "1",
    code: "INSURANCE",
    nameRu: "Страховка",
    nameEn: "Insurance",
    description: "Покрытие на случай утери или повреждения посылки",
    pricingType: "percent",
    value: 1.5,
    currency: null,
    applicableDeliveryTypes: ["Авиа", "Море", "Экспресс"],
    isActive: true,
    sortOrder: 10,
    icon: Shield,
  },
  {
    id: "2",
    code: "PHOTO",
    nameRu: "Фото-отчёт",
    nameEn: "Photo report",
    description: "Снимки содержимого и упаковки перед отправкой",
    pricingType: "perUnit",
    value: 2,
    currency: "USD",
    applicableDeliveryTypes: ["Авиа", "Море", "Экспресс"],
    isActive: true,
    sortOrder: 20,
    icon: Camera,
  },
  {
    id: "3",
    code: "PACK",
    nameRu: "Усиленная упаковка",
    nameEn: "Reinforced packaging",
    description: "Дополнительный картон, пузырьковая плёнка, скотч",
    pricingType: "fixed",
    value: 5,
    currency: "USD",
    applicableDeliveryTypes: ["Авиа", "Экспресс"],
    isActive: true,
    sortOrder: 30,
    icon: PackageOpen,
  },
  {
    id: "4",
    code: "CONSOL",
    nameRu: "Консолидация",
    nameEn: "Consolidation",
    description: "Объединение нескольких заказов в одну посылку",
    pricingType: "fixed",
    value: 3,
    currency: "USD",
    applicableDeliveryTypes: ["Море"],
    isActive: true,
    sortOrder: 40,
    icon: Layers,
  },
  {
    id: "5",
    code: "CALC",
    nameRu: "Расчёт сметы",
    nameEn: "Cost calculation",
    description: "Ручная калькуляция итоговой стоимости",
    pricingType: "fixed",
    value: 1,
    currency: "USD",
    applicableDeliveryTypes: [],
    isActive: false,
    sortOrder: 50,
    icon: Calculator,
  },
];

const PRICING_LABELS: Record<PricingType, string> = {
  fixed: "Фикс",
  percent: "% от суммы",
  perUnit: "За единицу",
  perKg: "За кг",
};

function formatPrice(s: MockService): string {
  switch (s.pricingType) {
    case "percent":
      return `${s.value} %`;
    case "perKg":
      return `${s.value} ${s.currency ?? ""} / кг`;
    case "perUnit":
      return `${s.value} ${s.currency ?? ""} / шт`;
    case "fixed":
    default:
      return `${s.value} ${s.currency ?? ""}`;
  }
}

const SORT_FIELDS = ["nameRu", "code", "pricingType", "value", "isActive", "sortOrder"] as const;
type SortField = (typeof SORT_FIELDS)[number];

// Компаратор для mock-данных (услуги пока в памяти, без БД).
function compareServices(a: MockService, b: MockService, field: SortField): number {
  switch (field) {
    case "value":
      return a.value - b.value;
    case "isActive":
      return Number(a.isActive) - Number(b.isActive);
    case "nameRu":
      return a.nameRu.localeCompare(b.nameRu, "ru");
    case "code":
      return a.code.localeCompare(b.code);
    case "pricingType":
      return a.pricingType.localeCompare(b.pricingType);
    case "sortOrder":
    default:
      return a.sortOrder - b.sortOrder;
  }
}

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const params = await searchParams;
  const [sortField, sortDir] = parseSortParam(params.sort, SORT_FIELDS, "sortOrder", "asc");
  const services = [...SERVICES].sort((a, b) => {
    const cmp = compareServices(a, b, sortField);
    return sortDir === "asc" ? cmp : -cmp;
  });
  const activeCount = SERVICES.filter((s) => s.isActive).length;

  const sortHref = (field: SortField) => {
    const nextDir = sortField === field ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    return buildListHref("/services", {}, { sort: `${field}_${nextDir}` });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Справочник</p>
          <h1 className="page-title">Дополнительные услуги</h1>
          <p className="page-subtitle">
            {SERVICES.length} услуг · {activeCount} активных · подключаются к посылке и заказу
          </p>
        </div>
        <Link href="#" className="btn btn-primary" aria-disabled="true" title="Будет доступно на шаге 3">
          <Plus size={16} aria-hidden="true" />
          Новая услуга
        </Link>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th><SortableHeader label="Услуга" href={sortHref("nameRu")} active={sortField === "nameRu"} direction={sortDir} /></th>
                <th><SortableHeader label="Код" href={sortHref("code")} active={sortField === "code"} direction={sortDir} /></th>
                <th><SortableHeader label="Тип стоимости" href={sortHref("pricingType")} active={sortField === "pricingType"} direction={sortDir} /></th>
                <th><SortableHeader label="Стоимость" href={sortHref("value")} active={sortField === "value"} direction={sortDir} /></th>
                <th>Применима к</th>
                <th><SortableHeader label="Активна" href={sortHref("isActive")} active={sortField === "isActive"} direction={sortDir} /></th>
                <th><SortableHeader label="Порядок" href={sortHref("sortOrder")} active={sortField === "sortOrder"} direction={sortDir} /></th>
                <th className="th-actions">Действия</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => {
                const Icon = s.icon;
                return (
                  <tr key={s.id} className={s.isActive ? "" : "row-dim"}>
                    <td>
                      <div className="service-cell">
                        <span className="service-icon" aria-hidden="true">
                          <Icon size={16} />
                        </span>
                        <div className="service-text">
                          <span className="service-name-ru">{s.nameRu}</span>
                          <span className="service-name-en">{s.nameEn}</span>
                          <span className="service-desc">{s.description}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="code-pill">{s.code}</span>
                    </td>
                    <td>
                      <span className="pricing-pill">{PRICING_LABELS[s.pricingType]}</span>
                    </td>
                    <td className="tabular">{formatPrice(s)}</td>
                    <td>
                      {s.applicableDeliveryTypes.length === 0 ? (
                        <span className="muted">—</span>
                      ) : (
                        <div className="chips">
                          {s.applicableDeliveryTypes.map((d) => (
                            <span key={d} className="chip">{d}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${s.isActive ? "badge--on" : "badge--off"}`}>
                        {s.isActive ? "Активна" : "Выключена"}
                      </span>
                    </td>
                    <td className="tabular muted">{s.sortOrder}</td>
                    <td className="td-actions">
                      <button type="button" className="icon-btn" aria-label="Редактировать" disabled title="Шаг 3">
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                      <button type="button" className="icon-btn icon-btn--danger" aria-label="Удалить" disabled title="Шаг 3">
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {SERVICES.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-empty">
                    <Sparkles size={18} style={{ marginBottom: 8, opacity: 0.5 }} aria-hidden="true" />
                    <div>Услуг пока нет</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 20px; }

        .page-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .page-eyebrow { margin: 0 0 4px; color: var(--color-accent); font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); letter-spacing: -0.02em; }
        .page-subtitle { font-size: 13px; color: var(--color-muted); margin: 6px 0 0; }

        .btn { display: inline-flex; align-items: center; gap: 8px; padding: 9px 14px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; border: 1px solid transparent; text-decoration: none; transition: opacity 0.15s; }
        .btn[aria-disabled="true"], .btn:disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
        .btn-primary { color: var(--color-accent-fg); background: var(--color-accent); }

        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); overflow: hidden; }

        .table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th { text-align: left; padding: 10px 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .table td { padding: 14px 16px; border-bottom: 1px solid var(--color-border); color: var(--color-text); vertical-align: top; }
        .table tbody tr:last-child td { border-bottom: none; }
        .table tbody tr:hover td { background: var(--color-muted-bg); }
        .table .row-dim td { opacity: 0.6; }
        .th-actions, .td-actions { text-align: right; white-space: nowrap; }
        .td-actions { display: flex; justify-content: flex-end; gap: 6px; }

        .service-cell { display: flex; align-items: flex-start; gap: 10px; min-width: 240px; max-width: 360px; }
        .service-icon { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: var(--radius-sm); color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 12%, transparent); flex-shrink: 0; }
        .service-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .service-name-ru { color: var(--color-text); font-size: 13.5px; font-weight: 600; }
        .service-name-en { color: var(--color-muted); font-size: 11.5px; }
        .service-desc { color: var(--color-muted); font-size: 11.5px; line-height: 1.4; margin-top: 2px; }

        .code-pill { display: inline-flex; align-items: center; padding: 3px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--color-text); background: var(--color-muted-bg); white-space: nowrap; }
        .pricing-pill { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: var(--radius-full); font-size: 11.5px; color: var(--color-muted); background: var(--color-muted-bg); }
        .tabular { font-variant-numeric: tabular-nums; white-space: nowrap; }
        .muted { color: var(--color-muted); }

        .chips { display: flex; flex-wrap: wrap; gap: 4px; }
        .chip { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: var(--radius-full); font-size: 11px; color: var(--color-text); background: var(--color-muted-bg); border: 1px solid var(--color-border); }

        .badge { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: var(--radius-full); font-size: 11.5px; font-weight: 600; border: 1px solid transparent; }
        .badge--on { color: var(--color-status-completed); background: var(--color-status-completed-bg); border-color: color-mix(in srgb, var(--color-status-completed) 24%, transparent); }
        .badge--off { color: var(--color-muted); background: var(--color-muted-bg); border-color: var(--color-border); }

        .icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); background: transparent; color: var(--color-muted); transition: color 0.15s, background 0.15s; }
        .icon-btn:hover:not(:disabled) { color: var(--color-text); background: var(--color-muted-bg); }
        .icon-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .icon-btn--danger:hover:not(:disabled) { color: var(--color-danger); background: var(--color-danger-bg); }

        .table-empty { text-align: center; padding: 40px 16px !important; color: var(--color-muted); }

        @media (max-width: 900px) {
          .service-cell { min-width: 200px; }
          .service-desc { display: none; }
        }
      `}</style>
    </div>
  );
}
