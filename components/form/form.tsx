"use client";

// Окно (форма), как в 1С: заголовок окна (← → ☆ название … ссылка ×), командная панель с «Ещё» справа,
// шапка, страницы и подвал. Какие части видны — «Ещё» → «Изменить форму…»: своё у каждого сотрудника.
// Кнопки панели помечаются data-command="код" (и при нужде data-label, data-shortcut): каждая повторяется
// в «Ещё», а не поместившиеся в строку прячутся с панели и остаются только в «Ещё».
// Строки списков документов помечаются data-doc="order|parcel" и data-doc-id: щелчок делает строку текущей,
// и «Изменить» (F2), «Связанные документы» (Ctrl+Shift+S), «История изменений» работают по ней.
// Списку с полями поиска (search) окно ставит строку поиска справа на панели, как в 1С: Ctrl+F — в строку,
// Alt+F — «Расширенный поиск», Ctrl+Alt+F — найти по значению ячейки, по которой щёлкнули, Ctrl+Q — отменить.
// Esc — закрыть окно, как «×» (как в 1С).
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Link2, ListTree, X } from "lucide-react";
import FavoriteStar from "@/components/layout/favorite-star";
import { useForms } from "@/components/form/form-context";
import FormSettingsDialog, { type FormSettingsResult } from "@/components/form/form-settings";
import { applyWidths, attachResize, clearWidths } from "@/components/form/column-widths";
import { applyColumns, describeTables, headCells, type TableInfo } from "@/components/form/columns";
import MoreMenu, { type BarCommand } from "@/components/form/more-menu";
import FormSearch, { useListSearch } from "@/components/form/form-search";
import { SEARCH_PARAMS, type ColumnLayout, type ColumnWidths, type FormPart, type MoreCommandId } from "@/lib/form";
import { DOC_LINKS, cardTarget, isDocEntity, type DocTarget } from "@/lib/related";
import type { ListSearchField } from "@/lib/list-search";

// Поля ввода: в них Esc сначала только выводит из поля.
const EDITABLE = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea, select, [contenteditable="true"]';

// На обёртке (span вокруг кнопки с подтверждением) нажимается сама кнопка внутри.
function pressable(el: HTMLElement) {
  return el.matches("a, button") ? el : el.querySelector<HTMLElement>("a, button") ?? el;
}

type FormProps = {
  formKey: string; // ключ окна для «Изменить форму…»: латиница, цифры, дефис
  title: string;
  titleExtra?: React.ReactNode; // метки рядом с названием: статус, «оплачено»
  commands?: React.ReactNode; // кнопки командной панели слева от «Ещё»: классы cmd, cmd--primary, атрибут data-command
  links?: Partial<Record<MoreCommandId, string>>; // пункты «Ещё», которые открывают страницу, например «Изменить»
  guid?: string; // идентификатор записи — для «{guid}»
  header?: React.ReactNode; // шапка: отбор, поиск, реквизиты
  footer?: React.ReactNode; // подвал: итоги, пояснения
  search?: { fields: ListSearchField[] }; // поиск списка: поля «Где искать»; отбирает страница (lib/list-search.ts)
  children: React.ReactNode; // страницы
};

// Ячейка списка, по которой щёлкнули: заголовок её столбца и значение — для «Найти по текущему значению».
type CellValue = { column: string; value: string };

export default function Form({ formKey, title, titleExtra, commands, links, guid, header, footer, search, children }: FormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const forms = useForms();
  const ref = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<() => void>(() => {});
  const [bar, setBar] = useState<BarCommand[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasSearch, setHasSearch] = useState(false);
  const [hasDocRows, setHasDocRows] = useState(false);
  const [current, setCurrent] = useState<DocTarget | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [notice, setNotice] = useState("");
  const [cell, setCell] = useState<CellValue | null>(null);
  const listSearch = useListSearch(formKey, search?.fields);

  const settings = forms?.forms[formKey];
  const hidden = settings?.hidden ?? [];
  // Ширины и столбцы, сохранение — через ref: их читают обработчики, навешенные один раз.
  const widthsRef = useRef<ColumnWidths | undefined>(settings?.widths);
  const columnsRef = useRef<ColumnLayout | undefined>(settings?.columns);
  const saveRef = useRef(forms?.saveForm);
  const closeRef = useRef(forms?.closeCurrent);
  useEffect(() => {
    widthsRef.current = settings?.widths;
    columnsRef.current = settings?.columns;
    saveRef.current = forms?.saveForm;
    closeRef.current = forms?.closeCurrent;
  });
  // Документ окна: в карточке — сама запись, в списке — текущая строка.
  const card = cardTarget(formKey, guid);
  const target = card ?? current;
  const related = target ? DOC_LINKS[target.entity].related(target.id) : null;
  const history = target ? DOC_LINKS[target.entity].history?.(target.id) ?? null : null;
  const openCurrent = !card && current ? DOC_LINKS[current.entity].open(current.id) : null;
  const parts: FormPart[] = ["commands", ...(header ? (["header"] as const) : []), "pages", ...(footer ? (["footer"] as const) : [])];
  const shown = (part: FormPart) => !hidden.includes(part);

  // Окно следит за собой: какие кнопки на панели (они же — в «Ещё»), есть ли строка поиска («Найти…»)
  // и что не помещается в строку — то прячется с панели и остаётся в «Ещё». Кнопку, вызванную из «Ещё»,
  // панель показывает (data-pinned) — например, чтобы было видно её «Удалить? Да / Нет».
  useLayoutEffect(() => {
    const form = ref.current;
    const panel = barRef.current;
    if (!form || !panel) return;
    const scan = () => {
      setHasSearch(Boolean(form.querySelector('input[type="search"]')));
      setHasDocRows(Boolean(form.querySelector(".form-pages tr[data-doc-id]")));
      if (!form.querySelector(".form-pages tr[data-current]")) setCurrent((now) => (now ? null : now));
      const items = [...panel.querySelectorAll<HTMLElement>("[data-command]")].map((el) => ({
        id: el.dataset.command ?? "",
        label: el.dataset.label ?? el.textContent?.trim() ?? "",
        shortcut: el.dataset.shortcut,
        icon: el.querySelector("svg")?.outerHTML ?? "",
        disabled: pressable(el).matches(":disabled, [aria-disabled='true']"),
      }));
      setBar((now) => (JSON.stringify(now) === JSON.stringify(items) ? now : items));
    };
    const fit = () => {
      const more = panel.querySelector<HTMLElement>(".form-more");
      const searchBox = panel.querySelector<HTMLElement>(":scope > .form-search");
      const items = [...panel.children].filter(
        (el): el is HTMLElement => el instanceof HTMLElement && el !== more && el !== searchBox && el.tagName !== "STYLE"
      );
      items.forEach((el) => el.removeAttribute("data-overflow"));
      const gap = 6;
      let room = panel.clientWidth - (more?.offsetWidth ?? 0) - (searchBox ? searchBox.offsetWidth + gap : 0) - gap;
      for (const el of items) if (el.hasAttribute("data-pinned")) room -= el.offsetWidth + gap;
      for (const el of items) {
        if (el.hasAttribute("data-pinned")) continue;
        room -= el.offsetWidth + gap;
        if (room < 0) el.setAttribute("data-overflow", "");
      }
    };
    fitRef.current = fit;
    scan();
    fit();
    applyColumns(form, columnsRef.current);
    applyWidths(form, widthsRef.current);
    // Щелчок по строке списка документов — текущая строка (подсветка — в density.css).
    // Ячейка запоминается для «Найти по текущему значению»: заголовок столбца и текст.
    const onRowClick = (event: MouseEvent) => {
      const td = (event.target as HTMLElement).closest<HTMLTableCellElement>(".form-pages tbody td");
      const table = td?.closest("table");
      if (td && table && form.contains(td)) {
        const column = headCells(table)[td.cellIndex]?.textContent?.trim() ?? "";
        const value = td.textContent?.trim() ?? "";
        setCell(column && value && value !== "—" ? { column, value: value.slice(0, 100) } : null);
      }
      const row = (event.target as HTMLElement).closest<HTMLTableRowElement>(".form-pages tr[data-doc-id]");
      if (!row || !form.contains(row) || !isDocEntity(row.dataset.doc)) return;
      form.querySelectorAll("tr[data-current]").forEach((el) => el !== row && el.removeAttribute("data-current"));
      row.setAttribute("data-current", "");
      setCurrent({ entity: row.dataset.doc, id: row.dataset.docId ?? "" });
    };
    form.addEventListener("click", onRowClick);
    const detach = attachResize(
      form,
      () => widthsRef.current ?? {},
      (tableWidths) => {
        widthsRef.current = { ...widthsRef.current, ...tableWidths };
        saveRef.current?.(formKey, { widths: widthsRef.current });
      }
    );
    const resize = new ResizeObserver(fit);
    resize.observe(panel);
    const changes = new MutationObserver(() => {
      scan();
      fit();
      applyColumns(form, columnsRef.current);
      applyWidths(form, widthsRef.current);
    });
    changes.observe(form, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["disabled", "aria-disabled"],
    });
    return () => {
      resize.disconnect();
      changes.disconnect();
      detach();
      form.removeEventListener("click", onRowClick);
    };
  }, [formKey]);

  // Ctrl+Shift+S — «Связанные документы», F2 — открыть текущую строку списка, как в 1С.
  useEffect(() => {
    if (!related && !openCurrent) return;
    const onKey = (event: KeyboardEvent) => {
      if (related && event.ctrlKey && event.shiftKey && event.code === "KeyS") {
        event.preventDefault();
        router.push(related);
      } else if (openCurrent && event.key === "F2") {
        event.preventDefault();
        router.push(openCurrent);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [related, openCurrent, router]);

  // «Найти по текущему значению»: поле — по заголовку столбца ячейки; столбца нет среди полей — поиск по всем полям.
  const findValue = () => {
    if (!cell) return;
    const field = listSearch.fields.find((f) => f.label === cell.column) ?? listSearch.fields.find((f) => cell.column.startsWith(f.label));
    if (field) listSearch.extended(field.key, cell.value, "any");
    else listSearch.quick(cell.value);
  };
  const findValueRef = useRef(findValue);
  const listSearchRef = useRef(listSearch);
  useEffect(() => {
    findValueRef.current = findValue;
    listSearchRef.current = listSearch;
  });

  // Клавиши поиска, как в 1С. Ctrl+F — в строку поиска окна (если она есть), вместо поиска браузера.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "KeyF" && event.code !== "KeyQ") return;
      const s = listSearchRef.current;
      const ctrl = event.ctrlKey || event.metaKey;
      if (event.code === "KeyF" && ctrl && !event.altKey && !event.shiftKey) {
        const input = ref.current?.querySelector<HTMLInputElement>('input[type="search"]');
        if (!input) return;
        event.preventDefault();
        input.focus();
        input.select();
      } else if (!s.enabled) {
        return;
      } else if (event.code === "KeyF" && event.altKey && ctrl) {
        event.preventDefault();
        findValueRef.current();
      } else if (event.code === "KeyF" && event.altKey && !event.shiftKey) {
        event.preventDefault();
        s.openDialog();
      } else if (event.code === "KeyQ" && ctrl && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        s.cancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Esc — закрыть окно, как «×». Открытое меню или диалог Esc закрывает сам (клавиша помечена обработанной) — окно остаётся.
  // Курсор в поле ввода — первый Esc только выходит из поля: недописанная форма не закроется случайно.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.repeat || event.isComposing) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.matches(EDITABLE)) {
        active.blur();
        return;
      }
      closeRef.current?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  const searchActive = SEARCH_PARAMS.some((name) => params.get(name));
  const enabled = new Set<string>(["refresh", "editForm"]);
  for (const item of bar) if (!item.disabled) enabled.add(item.id);
  if (hasSearch) enabled.add("find");
  if (listSearch.enabled) enabled.add("advancedFind");
  if (listSearch.enabled && cell) enabled.add("findValue");
  if (searchActive) enabled.add("cancelFind");
  if (guid) enabled.add("guid");
  if (settings?.widths || settings?.columns) enabled.add("defaultSettings");
  if (history) enabled.add("changeHistory");
  if (openCurrent) enabled.add("edit");
  for (const id of Object.keys(links ?? {})) enabled.add(id);

  // «Настройка формы» → ОК / Применить: сохранить и сразу показать.
  const applySettings = async (result: FormSettingsResult) => {
    widthsRef.current = result.widths ?? undefined;
    columnsRef.current = result.columns ?? undefined;
    if (ref.current) {
      clearWidths(ref.current);
      applyColumns(ref.current, columnsRef.current);
      applyWidths(ref.current, widthsRef.current);
    }
    return forms ? forms.saveForm(formKey, result) : false;
  };

  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(done);
    } catch {
      setNotice("Не удалось скопировать");
    }
  };

  const run = (id: string) => {
    const button = barRef.current?.querySelector<HTMLElement>(`[data-command="${CSS.escape(id)}"]`);
    if (button) {
      const item = [...(barRef.current?.children ?? [])].find((el) => el.contains(button));
      if (item?.hasAttribute("data-overflow")) {
        item.setAttribute("data-pinned", "");
        fitRef.current();
      }
      return pressable(button).click();
    }
    const link = links?.[id as MoreCommandId];
    if (link) return router.push(link);
    switch (id) {
      case "refresh":
        router.refresh();
        return setNotice("Обновлено");
      case "editForm":
        if (ref.current) setTables(describeTables(ref.current));
        return setSettingsOpen(true);
      case "changeHistory":
        return history && router.push(history);
      case "edit":
        return openCurrent && router.push(openCurrent);
      case "find":
        return ref.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
      case "advancedFind":
        return listSearch.openDialog();
      case "findValue":
        return findValue();
      case "cancelFind": {
        const next = new URLSearchParams(params.toString());
        SEARCH_PARAMS.forEach((name) => next.delete(name));
        const query = next.toString();
        return router.push(query ? `${pathname}?${query}` : pathname);
      }
      case "guid":
        return guid && copy(guid, `Идентификатор скопирован: ${guid}`);
      case "defaultSettings":
        widthsRef.current = columnsRef.current = undefined;
        if (ref.current) {
          clearWidths(ref.current);
          applyColumns(ref.current, undefined);
        }
        forms?.saveForm(formKey, { widths: null, columns: null });
        return setNotice("Стандартные настройки");
    }
  };

  return (
    <section ref={ref} className="form" data-form={formKey}>
      <div className="form-titlebar">
        <div className="form-nav">
          <button type="button" onClick={() => router.back()} title="Назад" aria-label="Назад">
            <ArrowLeft size={15} />
          </button>
          <button type="button" onClick={() => router.forward()} title="Вперёд" aria-label="Вперёд">
            <ArrowRight size={15} />
          </button>
        </div>
        <h1 className="form-title">
          <FavoriteStar />
          {title}
        </h1>
        {titleExtra && <div className="form-title-extra">{titleExtra}</div>}
        <div className="form-tools">
          {notice && (
            <span className="form-notice" role="status">
              {notice}
            </span>
          )}
          <button
            type="button"
            className="form-tool"
            onClick={() => copy(window.location.href, "Ссылка скопирована")}
            title="Скопировать ссылку на это окно"
            aria-label="Скопировать ссылку"
          >
            <Link2 size={15} />
          </button>
          {forms?.closeCurrent && (
            <button type="button" className="form-tool" onClick={forms.closeCurrent} title="Закрыть окно (Esc)" aria-label="Закрыть окно">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div ref={barRef} className="form-commands" data-form-part="commands">
        {commands}
        {related ? (
          <Link href={related} className="cmd" data-command="related" data-shortcut="Ctrl+Shift+S">
            <ListTree size={15} />
            Связанные документы
          </Link>
        ) : (
          hasDocRows && (
            <button type="button" className="cmd" data-command="related" data-shortcut="Ctrl+Shift+S" disabled title="Выберите строку списка">
              <ListTree size={15} />
              Связанные документы
            </button>
          )
        )}
        {listSearch.enabled && <FormSearch search={listSearch} />}
        <MoreMenu
          bar={bar}
          enabled={enabled}
          onCommand={run}
          recentSearches={listSearch.history.map((item) => ({ label: item.label, onSelect: () => listSearch.apply(item) }))}
        />
      </div>
      {header && shown("header") && (
        <div className="form-header" data-form-part="header">
          {header}
        </div>
      )}
      {shown("pages") && (
        <div className="form-pages" data-form-part="pages">
          {children}
        </div>
      )}
      {footer && shown("footer") && (
        <div className="form-footer" data-form-part="footer">
          {footer}
        </div>
      )}

      {forms && (
        <FormSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          title={title}
          parts={parts}
          hidden={hidden}
          tables={tables}
          columns={settings?.columns}
          widths={settings?.widths}
          onSave={(result) => applySettings(result)}
        />
      )}

      <style>{`
        .form { display: flex; flex-direction: column; gap: 8px; min-width: 0; }

        .form-titlebar { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .form-nav { display: inline-flex; flex-shrink: 0; }
        .form-nav button {
          display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 24px;
          border: 1px solid var(--color-border-strong); background: #fff; color: var(--color-text-secondary); cursor: pointer;
        }
        .form-nav button:first-child { border-radius: 4px 0 0 4px; }
        .form-nav button + button { border-left: none; border-radius: 0 4px 4px 0; }
        .form-nav button:hover { background: var(--color-muted-bg); color: var(--color-text); }
        .form-title {
          display: flex; align-items: center; min-width: 0; margin: 0;
          font-size: 19px; font-weight: 700; line-height: 1.3; letter-spacing: -0.01em; color: var(--color-text);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .form-title .fav-star { top: 0; flex-shrink: 0; }
        .form-title-extra { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .form-tools { display: flex; align-items: center; gap: 2px; margin-left: auto; flex-shrink: 0; }
        .form-tool {
          display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px;
          border: none; background: none; border-radius: 4px; color: var(--color-muted); cursor: pointer;
        }
        .form-tool:hover { color: var(--color-text); background: var(--color-muted-bg); }
        .form-notice { margin-right: 6px; font-size: 12px; color: var(--color-success); white-space: nowrap; }

        .form-commands { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .form-commands > * { flex-shrink: 0; }
        .form-commands > [data-overflow] { display: none !important; }
        .cmd {
          display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px;
          font: inherit; font-size: 13px; font-weight: 500; line-height: 1; color: var(--color-text); white-space: nowrap;
          background: #fff; border: 1px solid var(--color-border-strong); border-radius: 4px;
          text-decoration: none; cursor: pointer; transition: background 0.15s, border-color 0.15s;
        }
        .cmd:hover { background: var(--color-muted-bg); }
        .cmd:disabled { opacity: 0.55; cursor: default; }
        .cmd--primary { color: #fff; font-weight: 600; background: var(--color-accent); border-color: var(--color-accent); }
        .cmd--primary:hover { background: var(--color-accent-hover); }
        .form-more { margin-left: auto; }
        .form-more[data-state="open"] { background: var(--color-muted-bg); }

        .form-header { display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap; }
        .form-pages { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
        /* Подвал всегда внизу окна, вплотную к нижней панели: на длинном списке прилипает к ней, на коротком стоит внизу */
        .form-footer {
          position: sticky; bottom: var(--shell-bottom, 0px); z-index: 4; margin: auto -4px 0; padding: 5px 4px;
          font-size: 12px; color: var(--color-muted); background: var(--color-bg); border-top: 1px solid var(--color-border);
        }

        .more-menu {
          z-index: 50; min-width: 300px; max-height: min(75dvh, var(--radix-dropdown-menu-content-available-height));
          overflow-y: auto; padding: 4px 0; background: #fff; border: 1px solid var(--color-border-strong);
          border-radius: 4px; box-shadow: var(--shadow-dropdown); font-size: 13px;
        }
        .more-item {
          display: flex; align-items: center; gap: 8px; padding: 5px 12px 5px 8px;
          color: var(--color-text); cursor: pointer; outline: none; user-select: none;
        }
        .more-item[data-highlighted], .more-item[data-state="open"] { background: #fde7b8; }
        .more-item[data-disabled] { color: var(--color-muted); opacity: 0.6; cursor: default; }
        .more-icon { display: inline-flex; width: 16px; flex-shrink: 0; color: var(--color-text-secondary); }
        .more-label { flex: 1; white-space: nowrap; }
        .more-key { margin-left: 16px; font-size: 12px; color: var(--color-muted); white-space: nowrap; }
        .more-sub { color: var(--color-muted); }
        .more-sep { height: 1px; margin: 4px 0; background: var(--color-border); }

        @media (max-width: 640px) {
          .form-title { font-size: 17px; white-space: normal; }
          .form-titlebar { flex-wrap: wrap; }
        }
      `}</style>
    </section>
  );
}
