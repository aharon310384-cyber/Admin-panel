// Версия документа и «Отчёт по изменениям версий объекта» — как в 1С. Рисуются на сервере.
// Таблицы без <thead>: это отчёт, а не список, — настройка столбцов окна (components/form/columns.ts) их не трогает.
import { formatDateTime } from "@/lib/utils";
import type { VersionComparison, VersionData, VersionHead } from "@/lib/versions";

/** Реквизиты и табличные части одной версии. */
export function VersionDataView({ data }: { data: VersionData }) {
  return (
    <div className="vr">
      <section className="vr-card">
        <h2 className="vr-title">Реквизиты</h2>
        <div className="vr-scroll">
          <table className="vr-grid">
            <tbody>
              {data.fields.map((f) => (
                <tr key={f.key}>
                  <th scope="row" className="vr-label">
                    {f.label}
                  </th>
                  <td>{f.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {data.tables.map((t) => (
        <section key={t.key} className="vr-card">
          <h2 className="vr-title">
            {t.label} <span className="vr-count">({t.rows.length})</span>
          </h2>
          <div className="vr-scroll">
            <table className="vr-grid">
              <tbody>
                <tr className="vr-head-row">
                  <th scope="col" className="vr-n">
                    N
                  </th>
                  {t.columns.map((c) => (
                    <th key={c} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
                {t.rows.map((row, i) => (
                  <tr key={i}>
                    <td className="vr-n">{i + 1}</td>
                    {row.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
                {t.rows.length === 0 && (
                  <tr>
                    <td colSpan={t.columns.length + 1} className="vr-none">
                      Нет строк
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <ReportStyles />
    </div>
  );
}

function VersionCaption({ head }: { head: VersionHead }) {
  return (
    <>
      № {head.version}
      <br />
      <span className="vr-head-sub">({formatDateTime(head.createdAt)})</span>
      {head.authorName && (
        <>
          <br />
          <span className="vr-head-sub">{head.authorName}</span>
        </>
      )}
    </>
  );
}

// Ячейки строки табличной части; ячейка, которая отличается от другой версии, — жирным.
function cells(row: string[] | null, other: string[] | null, count: number, side: string) {
  return Array.from({ length: count }, (_, j) => {
    const value = row?.[j] ?? "";
    const differs = Boolean(row && other && value !== (other[j] ?? ""));
    return (
      <td key={`${side}${j}`} className={differs ? "vr-cell-diff" : undefined}>
        {value}
      </td>
    );
  });
}

/** Отчёт сравнения двух версий: a — слева (новая), b — справа. Различия — голубым фоном. */
export function CompareReport({ objectName, comparison }: { objectName: string; comparison: VersionComparison }) {
  const { a, b, fields, tables } = comparison;
  return (
    <div className="vr vr-card vr-report">
      <h2 className="vr-report-title">Отчёт по изменениям версий объекта</h2>
      <p className="vr-object">
        <span>Имя изменённого объекта:</span> <strong>{objectName}</strong>
      </p>

      <div className="vr-scroll">
        <table className="vr-grid vr-grid--compare">
          <tbody>
            <tr className="vr-head-row">
              <th scope="col" className="vr-label">
                Версии
              </th>
              <th scope="col">
                <VersionCaption head={a} />
              </th>
              <th scope="col">
                <VersionCaption head={b} />
              </th>
            </tr>
            <tr className="vr-section">
              <td colSpan={3}>Реквизиты</td>
            </tr>
            {fields.map((f) => (
              <tr key={f.key} className={f.changed ? "vr-diff" : undefined}>
                <th scope="row" className="vr-label">
                  {f.label}
                </th>
                <td>{f.a}</td>
                <td>{f.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tables.length > 0 && <h3 className="vr-section-title">Табличные части</h3>}
      {tables.map((t) => {
        const count = t.columns.length;
        return (
          <div key={t.key} className="vr-scroll vr-part">
            <table className="vr-grid vr-grid--compare">
              <tbody>
                <tr className="vr-head-row">
                  <th scope="col" rowSpan={2} className="vr-label">
                    {t.label}
                  </th>
                  <th scope="colgroup" colSpan={count}>
                    № {a.version}
                  </th>
                  <th scope="colgroup" colSpan={count}>
                    № {b.version}
                  </th>
                </tr>
                <tr className="vr-head-row">
                  {[a, b].flatMap((head) =>
                    t.columns.map((c) => (
                      <th key={`${head.version}${c}`} scope="col" className="vr-col">
                        {c}
                      </th>
                    ))
                  )}
                </tr>
                {t.rows.map((row, i) => (
                  <tr key={i} className={row.changed ? "vr-diff" : undefined}>
                    <td className="vr-label vr-n">{i + 1}</td>
                    {cells(row.a, row.b, count, "a")}
                    {cells(row.b, row.a, count, "b")}
                  </tr>
                ))}
                {t.rows.length === 0 && (
                  <tr>
                    <td colSpan={count * 2 + 1} className="vr-none">
                      Нет строк
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })}
      <ReportStyles />
    </div>
  );
}

function ReportStyles() {
  return (
    <style>{`
      .vr { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
      .vr-card {
        padding: 10px 12px; background: var(--color-surface); border: 1px solid var(--color-border);
        border-radius: var(--radius-sm); box-shadow: 0 1px 3px rgba(58, 37, 16, 0.08);
      }
      .vr-report { gap: 8px; }
      .vr-title { margin: 0 0 8px; font-size: 14px; font-weight: 700; color: var(--color-text); }
      .vr-count { font-weight: 400; color: var(--color-muted); }
      .vr-report-title { margin: 0; font-size: 16px; font-weight: 700; color: var(--color-text); }
      .vr-object { margin: 0 0 4px; font-size: 13px; color: var(--color-text); }
      .vr-object span { color: var(--color-text-secondary); }
      .vr-section-title { margin: 8px 0 0; font-size: 13px; font-weight: 700; color: var(--color-text); }
      .vr-scroll { overflow-x: auto; }
      .vr-part + .vr-part { margin-top: 8px; }

      .vr-grid { border-collapse: collapse; font-size: 13px; background: #fff; }
      .vr-grid :is(th, td) {
        padding: 4px 8px; text-align: left; vertical-align: top; border: 1px solid #d3cdc2;
        color: var(--color-text); overflow-wrap: anywhere;
      }
      .vr-grid th { font-weight: 400; }
      .vr-grid .vr-label { width: 260px; min-width: 180px; font-weight: 400; background: #f7f4ee; }
      .vr-grid--compare td { min-width: 180px; }
      .vr-grid--compare .vr-col { min-width: 90px; }
      .vr-head-row th { font-weight: 600; background: #f0ebe1; white-space: nowrap; }
      .vr-head-sub { font-weight: 400; color: var(--color-text-secondary); }
      .vr-section td { font-weight: 700; background: #f0ebe1; }
      .vr-n { width: 1%; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
      .vr-grid .vr-diff > :is(td, th) { background: #dff5f8; }
      .vr-cell-diff { font-weight: 600; }
      .vr-none { color: var(--color-muted); text-align: center; }
    `}</style>
  );
}
