import type { Metadata } from "next";
import { Globe } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Страны" };

function dash(value: string | null | undefined): string {
  return value?.trim() || "—";
}

export default async function CountriesPage() {
  const countries = await prisma.country.findMany({
    orderBy: { nameRu: "asc" },
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Справочник стран</h1>
          <p className="page-subtitle">
            {countries.length} стран с ISO-кодами и форматами почтовых индексов
          </p>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Код</th>
                <th>Название (RU)</th>
                <th>Название (EN)</th>
                <th>Формат индекса</th>
                <th>Пример</th>
              </tr>
            </thead>
            <tbody>
              {countries.map((c) => (
                <tr key={c.code}>
                  <td>
                    <span className="code-pill">{c.code}</span>
                  </td>
                  <td>{c.nameRu}</td>
                  <td className="text-muted">{c.nameEn}</td>
                  <td className="mono text-muted">{dash(c.postalCodeRegex)}</td>
                  <td className="mono">{dash(c.postalCodeExample)}</td>
                </tr>
              ))}
              {countries.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-empty">
                    <Globe size={18} style={{ marginBottom: 8, opacity: 0.5 }} />
                    <div>Справочник пуст. Запустите prisma/seed-countries.ts</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 20px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .page-subtitle { font-size: 13px; color: var(--color-muted); margin: 4px 0 0; }

        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); overflow: hidden; }
        .table-wrap { overflow-x: auto; }
        .table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th { text-align: left; padding: 10px 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .table td { padding: 12px 16px; border-bottom: 1px solid var(--color-border); color: var(--color-text); }
        .table tbody tr:last-child td { border-bottom: none; }
        .table tbody tr:hover td { background: var(--color-muted-bg); }

        .code-pill { display: inline-flex; align-items: center; min-width: 36px; justify-content: center; padding: 3px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 12px; font-weight: 700; color: var(--color-text); background: var(--color-muted-bg); }
        .mono { font-family: var(--font-mono); font-size: 12px; }
        .text-muted { color: var(--color-muted); }

        .table-empty { text-align: center; padding: 40px 16px !important; color: var(--color-muted); }
      `}</style>
    </div>
  );
}
