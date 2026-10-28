"use client";

// Отборы журнала, как в 1С: значения — в адресе окна (status, client, from, to…), страница отбирает сама.
// Меняется отбор — меняется адрес; поиск и сортировка в адресе остаются.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

export type ListFilter =
  | { kind: "select"; name: string; label: string; options: { value: string; label: string }[] }
  | { kind: "period"; from: string; to: string; label: string }
  | { kind: "check"; name: string; label: string };

export default function ListFilters({ filters }: { filters: ListFilter[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };
  const names = filters.flatMap((f) => (f.kind === "period" ? [f.from, f.to] : [f.name]));
  const active = names.some((name) => params.get(name));

  return (
    <div className="lf">
      {filters.map((f) => {
        if (f.kind === "select") {
          return (
            <label key={f.name} className="lf-item">
              <span>{f.label}</span>
              <select value={params.get(f.name) ?? ""} onChange={(e) => set({ [f.name]: e.target.value || null })}>
                <option value="">все</option>
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          );
        }
        if (f.kind === "period") {
          return (
            <span key={f.from} className="lf-item">
              <span>{f.label}</span>
              <input type="date" value={params.get(f.from) ?? ""} onChange={(e) => set({ [f.from]: e.target.value || null })} aria-label={`${f.label}: с`} />
              <span className="lf-dash">—</span>
              <input type="date" value={params.get(f.to) ?? ""} onChange={(e) => set({ [f.to]: e.target.value || null })} aria-label={`${f.label}: по`} />
            </span>
          );
        }
        return (
          <label key={f.name} className="lf-item lf-check">
            <input type="checkbox" checked={params.get(f.name) === "1"} onChange={(e) => set({ [f.name]: e.target.checked ? "1" : null })} />
            {f.label}
          </label>
        );
      })}
      {active && (
        <button type="button" className="lf-clear" onClick={() => set(Object.fromEntries(names.map((name) => [name, null])))}>
          <X size={13} /> Сбросить отбор
        </button>
      )}
      <style>{`
        .lf { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 14px; font-size: 13px; }
        .lf-item { display: inline-flex; align-items: center; gap: 6px; color: var(--color-muted); }
        .lf-item select, .lf-item input[type="date"] {
          height: 26px; padding: 0 6px; font: inherit; color: var(--color-text); background: #fff;
          border: 1px solid var(--color-border-strong); border-radius: 4px; max-width: 220px;
        }
        .lf-dash { color: var(--color-muted); }
        .lf-check { color: var(--color-text); cursor: pointer; }
        .lf-clear { display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 8px; border: 1px solid var(--color-border-strong); border-radius: 4px; background: #fde7b8; font: inherit; cursor: pointer; }
      `}</style>
    </div>
  );
}
