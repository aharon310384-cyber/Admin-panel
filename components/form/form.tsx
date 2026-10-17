"use client";

// Окно (форма), как в 1С: заголовок окна (← → ☆ название … ссылка ×), командная панель с «Ещё» справа,
// шапка, страницы и подвал. Какие части видны — «Ещё» → «Изменить форму…»: своё у каждого сотрудника.
// Кнопки панели помечаются data-command="код" (и при нужде data-label, data-shortcut): каждая повторяется
// в «Ещё», а не поместившиеся в строку прячутся с панели и остаются только в «Ещё».
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Link2, ListTree, X } from "lucide-react";
import FavoriteStar from "@/components/layout/favorite-star";
import { useForms } from "@/components/form/form-context";
import FormSettingsDialog from "@/components/form/form-settings";
import { applyWidths, attachResize, clearWidths } from "@/components/form/column-widths";
import MoreMenu, { type BarCommand } from "@/components/form/more-menu";
import { SEARCH_PARAMS, type ColumnWidths, type FormPart, type MoreCommandId } from "@/lib/form";
import { relatedDocumentsFor } from "@/lib/related";

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
  children: React.ReactNode; // страницы
};

export default function Form({ formKey, title, titleExtra, commands, links, guid, header, footer, children }: FormProps) {
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
  const [notice, setNotice] = useState("");

  const settings = forms?.forms[formKey];
  const hidden = settings?.hidden ?? [];
  // Ширины столбцов и сохранение — через ref: их читают обработчики, навешенные один раз.
  const widthsRef = useRef<ColumnWidths | undefined>(settings?.widths);
  const saveRef = useRef(forms?.saveForm);
  useEffect(() => {
    widthsRef.current = settings?.widths;
    saveRef.current = forms?.saveForm;
  });
  const related = relatedDocumentsFor(formKey, guid);
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
      const items = [...panel.children].filter(
        (el): el is HTMLElement => el instanceof HTMLElement && el !== more && el.tagName !== "STYLE"
      );
      items.forEach((el) => el.removeAttribute("data-overflow"));
      const gap = 6;
      let room = panel.clientWidth - (more?.offsetWidth ?? 0) - gap;
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
    applyWidths(form, widthsRef.current);
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
    };
  }, [formKey]);

  // Ctrl+Shift+S — «Связанные документы», как в 1С.
  useEffect(() => {
    if (!related) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.code === "KeyS") {
        event.preventDefault();
        router.push(related);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [related, router]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  const searchActive = SEARCH_PARAMS.some((name) => params.get(name));
  const enabled = new Set<string>(["refresh", "editForm"]);
  for (const item of bar) if (!item.disabled) enabled.add(item.id);
  if (hasSearch) enabled.add("find");
  if (searchActive) enabled.add("cancelFind");
  if (guid) enabled.add("guid");
  if (settings?.widths) enabled.add("defaultSettings");
  for (const id of Object.keys(links ?? {})) enabled.add(id);

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
        return setSettingsOpen(true);
      case "find":
        return ref.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
      case "cancelFind": {
        const next = new URLSearchParams(params.toString());
        SEARCH_PARAMS.forEach((name) => next.delete(name));
        const query = next.toString();
        return router.push(query ? `${pathname}?${query}` : pathname);
      }
      case "guid":
        return guid && copy(guid, `Идентификатор скопирован: ${guid}`);
      case "defaultSettings":
        if (ref.current) clearWidths(ref.current);
        widthsRef.current = undefined;
        forms?.saveForm(formKey, { widths: null });
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
            <button type="button" className="form-tool" onClick={forms.closeCurrent} title="Закрыть окно" aria-label="Закрыть окно">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div ref={barRef} className="form-commands" data-form-part="commands">
        {commands}
        {related && (
          <Link href={related} className="cmd" data-command="related" data-shortcut="Ctrl+Shift+S">
            <ListTree size={15} />
            Связанные документы
          </Link>
        )}
        <MoreMenu bar={bar} enabled={enabled} onCommand={run} />
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
          onSave={(next) => forms.saveForm(formKey, { hidden: next })}
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
        /* Подвал всегда на виду: на длинном списке прилипает к низу экрана, над нижней панелью */
        .form-footer {
          position: sticky; bottom: var(--shell-bottom, 0px); z-index: 4; margin: 0 -4px; padding: 5px 4px;
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
        .more-item[data-highlighted] { background: #fde7b8; }
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
