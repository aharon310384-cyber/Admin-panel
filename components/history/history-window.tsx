"use client";

// Окно «История изменений» документа — как в 1С: отбор «Изменения в реквизитах», версии новыми сверху,
// текущая версия документа — жирным. Щелчок — текущая строка, Ctrl/⌘+щелчок — вторая строка для сравнения,
// двойной щелчок или Enter — открыть версию.
import { useState } from "react";
import { useRouter } from "next/navigation";
import NextForm from "next/form";
import Form from "@/components/form/form";

export type HistoryRow = {
  version: number;
  prev: number | null; // предыдущая версия во всей истории — для «Сравнить» с одной выделенной строкой
  author: string;
  date: string;
  comment: string;
};

type Props = {
  base: string; // адрес окна: /history/order/{id}
  title: string;
  rows: HistoryRow[]; // уже с отбором
  total: number; // версий всего
  lastVersion: number | null; // текущая версия документа
  field: string; // отбор «Изменения в реквизитах»; пусто — все
  fieldOptions: { key: string; label: string }[];
  emptyText: string;
};

export default function HistoryWindow({ base, title, rows, total, lastVersion, field, fieldOptions, emptyText }: Props) {
  const router = useRouter();
  const [current, setCurrent] = useState<number | null>(rows[0]?.version ?? null);
  const [second, setSecond] = useState<number | null>(null);

  const open = (version: number | null) => {
    if (version != null) router.push(`${base}/${version}`);
  };

  // Две выделенные версии, а при одной — она и предыдущая. В адресе a — старая, b — новая.
  const prev = rows.find((row) => row.version === current)?.prev ?? null;
  const pair = current == null ? null : second != null ? [current, second] : prev != null ? [prev, current] : null;
  const compareHref = pair ? `${base}/compare?a=${Math.min(...pair)}&b=${Math.max(...pair)}` : null;

  const select = (event: React.MouseEvent, version: number) => {
    if (event.ctrlKey || event.metaKey) {
      if (version !== current) setSecond((now) => (now === version ? null : version));
      return;
    }
    setCurrent(version);
    setSecond(null);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      open(current);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const index = rows.findIndex((row) => row.version === current);
    const next = rows[Math.min(rows.length - 1, Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)))];
    if (next) {
      setCurrent(next.version);
      setSecond(null);
    }
  };

  const header = (
    <NextForm action={base} className="hist-filter">
      <label htmlFor="hist-field">Изменения в реквизитах:</label>
      <select id="hist-field" name="field" defaultValue={field} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
        <option value="">Все</option>
        {fieldOptions.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </NextForm>
  );

  const commands = (
    <>
      <button type="button" className="cmd cmd--primary" data-command="open-version" disabled={current == null} onClick={() => open(current)}>
        Открыть версию
      </button>
      <button
        type="button"
        className="cmd"
        data-command="compare"
        disabled={!compareHref}
        title="Две выделенные версии (Ctrl+щелчок), а при одной — с предыдущей"
        onClick={() => compareHref && router.push(compareHref)}
      >
        Сравнить
      </button>
      <button type="button" className="cmd" data-command="restore" disabled title="Скоро">
        Перейти на версию
      </button>
    </>
  );

  const footer = (
    <>
      Версий: {rows.length}
      {rows.length !== total && ` из ${total}`}
      {rows.length > 1 && " · Ctrl+щелчок — вторая версия для сравнения"}
    </>
  );

  return (
    <Form formKey="history" title={title} header={header} commands={commands} footer={footer}>
      {rows.length === 0 ? (
        <p className="hist-empty">{emptyText}</p>
      ) : (
        <div className="hist-card">
          <div className="table-wrap" tabIndex={0} onKeyDown={onKeyDown} aria-label="Версии документа">
            <table className="table hist-table">
              <thead>
                <tr>
                  <th className="hist-num">№</th>
                  <th>Автор изменений</th>
                  <th>Дата</th>
                  <th>Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.version}
                    className={row.version === lastVersion ? "hist-last" : undefined}
                    data-current={row.version === current || undefined}
                    data-second={row.version === second || undefined}
                    onClick={(event) => select(event, row.version)}
                    onDoubleClick={() => open(row.version)}
                  >
                    <td className="hist-num">{row.version}</td>
                    <td>{row.author}</td>
                    <td className="hist-date">{row.date}</td>
                    <td className="hist-comment">{row.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        .hist-filter { display: flex; align-items: center; gap: 8px; font-size: 13px; }
        .hist-filter label { color: var(--color-text-secondary); white-space: nowrap; }
        .hist-filter select {
          height: 26px; min-width: 240px; max-width: 100%; padding: 0 6px; font: inherit; font-size: 13px;
          color: var(--color-text); background: #fff; border: 1px solid var(--color-border-strong); border-radius: 4px;
        }
        .hist-card {
          background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm);
          box-shadow: 0 1px 3px rgba(58, 37, 16, 0.08); overflow: hidden;
        }
        .hist-card .table-wrap { overflow: auto; outline: none; }
        .hist-card .table-wrap:focus-visible { box-shadow: inset 0 0 0 2px var(--accent-soft); }
        .hist-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .hist-table th {
          text-align: left; padding: 6px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap;
        }
        .hist-table td {
          padding: 4px 10px; border-bottom: 1px solid var(--color-border); color: var(--color-text);
          white-space: nowrap; cursor: default; user-select: none;
        }
        .hist-table tbody tr:last-child td { border-bottom: none; }
        .hist-table tbody tr:hover td { background: var(--color-muted-bg); }
        .hist-table tr.hist-last td { font-weight: 700; }
        .hist-table tr[data-current] > td { background: #fde7b8; }
        .hist-table tr[data-second] > td { background: #fef3dc; box-shadow: inset 0 1px 0 #efc77a, inset 0 -1px 0 #efc77a; }
        .hist-num { width: 1%; text-align: right; font-variant-numeric: tabular-nums; }
        .hist-date { font-variant-numeric: tabular-nums; }
        .hist-table td.hist-comment { white-space: normal; min-width: 200px; }
        .hist-empty {
          margin: 0; padding: 28px 16px; font-size: 13px; text-align: center; color: var(--color-muted);
          background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm);
        }
      `}</style>
    </Form>
  );
}
