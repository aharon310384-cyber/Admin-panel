"use client";

// Поиск в списке, как в 1С: строка «Поиск (Ctrl+F)» с крестиком, кнопка поиска с меню (расширенный поиск, недавние
// поиски, «Отменить поиск»), окно «Расширенный поиск» (Alt+F): где искать, что искать, как искать.
// Поиск держится в адресе окна (lib/list-search.ts), отбирает сам сервер — находится всё, а не только видимые строки.
// Недавние поиски — у каждого окна свои, в браузере сотрудника.
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Search, SearchX, X } from "lucide-react";
import { SEARCH_MODES, readListSearch, type ListSearchField, type SearchMode } from "@/lib/list-search";

export type SearchHistoryItem = { label: string; q?: string; sf?: string; sv?: string; sm?: SearchMode };
type DialogState = { open: boolean; field: string; value: string; mode: SearchMode };

const HISTORY_SIZE = 8;
const modeLabel = (mode: SearchMode) => SEARCH_MODES.find(([m]) => m === mode)?.[1] ?? "";

/** Состояние и действия поиска окна: их зовут строка поиска, меню «Ещё» и клавиши. */
export function useListSearch(formKey: string, fields: ListSearchField[] | undefined) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = readListSearch(Object.fromEntries(params.entries()));
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [dialog, setDialog] = useState<DialogState>({ open: false, field: "", value: "", mode: "any" });
  const storageKey = `list-search:${formKey}`;
  const enabled = Boolean(fields?.length);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(saved)) setHistory(saved.slice(0, HISTORY_SIZE));
    } catch {
      setHistory([]);
    }
  }, [storageKey]);

  const fieldLabel = (key: string | null) => fields?.find((f) => f.key === key)?.label ?? key ?? "";

  const go = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const remember = (item: SearchHistoryItem) => {
    setHistory((prev) => {
      const next = [item, ...prev.filter((h) => h.label !== item.label)].slice(0, HISTORY_SIZE);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // без сохранения истории поиск всё равно работает
      }
      return next;
    });
  };

  /** Поиск по всем полям (строка поиска). Пустая строка — снять. */
  const quick = (text: string) => {
    const value = text.trim();
    if (value) remember({ label: `Все поля - ${value}`, q: value });
    go({ q: value || null });
  };

  /** Расширенный поиск по одному полю. */
  const extended = (field: string, text: string, mode: SearchMode) => {
    const value = text.trim();
    if (!value) return go({ sf: null, sv: null, sm: null });
    remember({ label: `${fieldLabel(field)} - ${value}${mode === "any" ? "" : ` (${modeLabel(mode)})`}`, sf: field, sv: value, sm: mode });
    go({ sf: field, sv: value, sm: mode === "any" ? null : mode });
  };

  const apply = (item: SearchHistoryItem) => (item.q ? quick(item.q) : item.sf && item.sv ? extended(item.sf, item.sv, item.sm ?? "any") : undefined);
  const cancel = () => go({ q: null, sf: null, sv: null, sm: null });
  const openDialog = (prefill?: { field?: string; value?: string; mode?: SearchMode }) =>
    setDialog({
      open: true,
      field: prefill?.field ?? current.field ?? fields?.[0]?.key ?? "",
      value: prefill?.value ?? current.value,
      mode: prefill?.mode ?? current.mode,
    });

  return {
    enabled,
    fields: fields ?? [],
    current,
    active: Boolean(current.q || (current.field && current.value)),
    fieldLabel,
    history,
    quick,
    extended,
    apply,
    cancel,
    openDialog,
    dialog,
    setDialog,
  };
}

export type ListSearchState = ReturnType<typeof useListSearch>;

/** Строка поиска на командной панели окна и окно «Расширенный поиск». */
export default function FormSearch({ search }: { search: ListSearchState }) {
  const { current, dialog, setDialog } = search;
  const [text, setText] = useState(current.q);
  useEffect(() => setText(current.q), [current.q]);
  const extendedActive = Boolean(current.field && current.value);

  return (
    <div className="form-search">
      {extendedActive && (
        <span className="form-search-chip" title="Расширенный поиск — Отменить: Ctrl+Q">
          {search.fieldLabel(current.field)}: «{current.value}»{current.mode === "any" ? "" : ` (${modeLabel(current.mode)})`}
          <button type="button" onClick={() => search.extended(current.field ?? "", "", "any")} aria-label="Снять расширенный поиск">
            <X size={12} />
          </button>
        </span>
      )}
      <form
        className="form-search-box"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          search.quick(text);
        }}
      >
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Поиск (Ctrl+F)"
          aria-label="Поиск по списку"
        />
        {(text || current.q) && (
          <button type="button" className="form-search-clear" onClick={() => { setText(""); search.quick(""); }} aria-label="Очистить поиск">
            <X size={13} />
          </button>
        )}
      </form>
      <Menu.Root modal={false}>
        <Menu.Trigger asChild>
          <button type="button" className="cmd form-search-btn" aria-label="Управление поиском">
            <Search size={14} />
            <ChevronDown size={12} />
          </button>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content className="more-menu" align="end" sideOffset={4} collisionPadding={8}>
            <Menu.Item className="more-item" onSelect={() => search.openDialog()}>
              <span className="more-icon"><Search size={15} /></span>
              <span className="more-label">Расширенный поиск…</span>
              <span className="more-key">Alt+F</span>
            </Menu.Item>
            {search.history.length > 0 && <Menu.Separator className="more-sep" />}
            {search.history.map((item) => (
              <Menu.Item key={item.label} className="more-item" onSelect={() => search.apply(item)}>
                <span className="more-icon" />
                <span className="more-label">{item.label}</span>
              </Menu.Item>
            ))}
            <Menu.Separator className="more-sep" />
            <Menu.Item className="more-item" disabled={!search.active} onSelect={() => search.cancel()}>
              <span className="more-icon"><SearchX size={15} /></span>
              <span className="more-label">Отменить поиск</span>
              <span className="more-key">Ctrl+Q</span>
            </Menu.Item>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>

      <Dialog.Root open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}>
        <Dialog.Portal>
          <Dialog.Overlay className="fs-overlay" />
          <Dialog.Content className="fs-dialog" aria-describedby={undefined}>
            <div className="fs-head">
              <Dialog.Title className="fs-title">Расширенный поиск</Dialog.Title>
              <Dialog.Close className="fs-x" aria-label="Закрыть"><X size={16} /></Dialog.Close>
            </div>
            <form
              className="fs-body"
              onSubmit={(e) => {
                e.preventDefault();
                setDialog((d) => ({ ...d, open: false }));
                search.extended(dialog.field, dialog.value, dialog.mode);
              }}
            >
              <label className="fs-row">
                <span>Где искать</span>
                <select value={dialog.field} onChange={(e) => setDialog((d) => ({ ...d, field: e.target.value }))}>
                  {search.fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
              </label>
              <label className="fs-row">
                <span>Что искать</span>
                <input autoFocus value={dialog.value} onChange={(e) => setDialog((d) => ({ ...d, value: e.target.value }))} />
              </label>
              <div className="fs-row fs-row--top">
                <span id="fs-mode-label">Как искать</span>
                <div className="fs-modes" role="radiogroup" aria-labelledby="fs-mode-label">
                  {SEARCH_MODES.map(([mode, label]) => (
                    <label key={mode}>
                      <input type="radio" name="fs-mode" checked={dialog.mode === mode} onChange={() => setDialog((d) => ({ ...d, mode }))} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="fs-actions">
                <button type="submit" className="cmd cmd--primary" disabled={!dialog.value.trim()}>Найти</button>
                <Dialog.Close className="cmd">Отмена</Dialog.Close>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <style>{`
        .form-search { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; min-width: 0; }
        .form-search + .form-more { margin-left: 0; }
        .form-search-box { position: relative; display: inline-flex; }
        .form-search-box input {
          width: 220px; height: 26px; padding: 0 24px 0 8px; font: inherit; font-size: 13px; color: var(--color-text);
          background: #fff; border: 1px solid var(--color-border-strong); border-radius: 4px; outline: none;
        }
        .form-search-box input:focus { border-color: var(--color-accent); }
        .form-search-box input::-webkit-search-cancel-button { display: none; }
        .form-search-clear {
          position: absolute; right: 3px; top: 50%; transform: translateY(-50%); display: inline-flex; padding: 3px;
          border: none; background: none; color: var(--color-muted); cursor: pointer; border-radius: 3px;
        }
        .form-search-clear:hover { color: var(--color-text); background: var(--color-muted-bg); }
        .form-search-btn { padding: 0 6px; gap: 2px; }
        .form-search-chip {
          display: inline-flex; align-items: center; gap: 4px; max-width: 280px; height: 24px; padding: 0 4px 0 8px;
          font-size: 12px; background: #fde7b8; border: 1px solid #e0a84a; border-radius: 4px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
        }
        .form-search-chip button { display: inline-flex; border: none; background: none; cursor: pointer; padding: 2px; color: var(--color-text-secondary); }
        .fs-overlay { position: fixed; inset: 0; z-index: 60; background: rgba(31, 26, 20, 0.3); }
        .fs-dialog {
          position: fixed; z-index: 61; top: 18dvh; left: 50%; transform: translateX(-50%); width: min(460px, calc(100vw - 24px));
          background: #fffcf6; border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow); padding: 12px 14px; font-size: 13px;
        }
        .fs-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .fs-title { margin: 0; font-size: 16px; font-weight: 700; }
        .fs-x { display: inline-flex; border: none; background: none; cursor: pointer; padding: 4px; color: var(--color-muted); }
        .fs-body { display: flex; flex-direction: column; gap: 10px; }
        .fs-row { display: flex; align-items: center; gap: 10px; }
        .fs-row--top { align-items: flex-start; }
        .fs-row > span { width: 100px; flex-shrink: 0; color: var(--color-muted); }
        .fs-row select, .fs-row input:not([type="radio"]) {
          flex: 1; min-width: 0; height: 28px; padding: 0 8px; font: inherit; border: 1px solid var(--color-border-strong); border-radius: 4px; background: #fff;
        }
        .fs-modes { display: flex; flex-direction: column; gap: 6px; }
        .fs-modes label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
        .fs-modes input { accent-color: var(--color-accent); margin: 0; }
        .fs-actions { display: flex; justify-content: flex-end; gap: 8px; }
        @media (max-width: 640px) { .form-search-box input { width: 140px; } }
      `}</style>
    </div>
  );
}
