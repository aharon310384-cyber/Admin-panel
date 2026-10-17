"use client";

// «Настройка формы» — как в 1С: слева элементы формы (части окна) с флажками, справа свойства выбранного.
// Командная панель есть всегда — у неё галочка без флажка. Своё у каждого сотрудника и у каждого окна.
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, PanelsTopLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FORM_PART_HINTS, FORM_PART_LABELS, HIDEABLE_PARTS, type FormPart } from "@/lib/form";

export default function FormSettingsDialog({
  open,
  onOpenChange,
  title,
  parts,
  hidden,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  parts: FormPart[];
  hidden: FormPart[];
  onSave: (hidden: FormPart[]) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<FormPart[]>(hidden);
  const [selected, setSelected] = useState<FormPart>(parts[0]);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  // Каждый раз окно открывается с сохранённой настройкой. Пока окно открыто, «Применить» его не сбрасывает.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setDraft(hidden);
      setSelected(parts[0]);
      setMessage("");
    }
    wasOpen.current = open;
  }, [open, hidden, parts]);

  const visible = (part: FormPart) => !draft.includes(part);
  const toggle = (part: FormPart) => {
    if (!HIDEABLE_PARTS.includes(part)) return;
    setDraft((now) => (now.includes(part) ? now.filter((p) => p !== part) : [...now, part]));
    setMessage("");
  };

  const save = (close: boolean) =>
    startTransition(async () => {
      const ok = await onSave(draft);
      if (!ok) setMessage("Не удалось сохранить");
      else if (close) onOpenChange(false);
      else setMessage("Применено");
    });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fs-overlay" />
        <Dialog.Content className="fs-dialog" aria-describedby={undefined}>
          <div className="fs-head">
            <Dialog.Title className="fs-title">Настройка формы</Dialog.Title>
            <Dialog.Close className="fs-x" aria-label="Закрыть">
              <X size={18} />
            </Dialog.Close>
          </div>

          <div className="fs-body">
            <div className="fs-col">
              <p className="fs-col-title">Элементы формы</p>
              <div className="fs-tree" role="tree" aria-label="Элементы формы">
                <div className="fs-node fs-node--root">
                  <PanelsTopLeft size={15} />
                  <span>Форма: {title}</span>
                </div>
                {parts.map((part) => {
                  const fixed = !HIDEABLE_PARTS.includes(part);
                  return (
                    <div
                      key={part}
                      role="treeitem"
                      aria-selected={selected === part}
                      tabIndex={0}
                      className={cn("fs-node", selected === part && "fs-node--selected")}
                      onClick={() => setSelected(part)}
                      onKeyDown={(e) => {
                        if (e.key === " " && !fixed) {
                          e.preventDefault();
                          toggle(part);
                        }
                      }}
                    >
                      {fixed ? (
                        <Check size={15} className="fs-fixed" aria-label="Есть всегда" />
                      ) : (
                        <input
                          type="checkbox"
                          checked={visible(part)}
                          onChange={() => toggle(part)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Показывать «${FORM_PART_LABELS[part]}»`}
                        />
                      )}
                      <span>{FORM_PART_LABELS[part]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="fs-col">
              <p className="fs-col-title">Свойства элемента формы</p>
              <div className="fs-props">
                <label className="fs-prop">
                  <span>Заголовок</span>
                  <input className="fs-input" value={FORM_PART_LABELS[selected]} readOnly />
                </label>
                <label className="fs-prop">
                  <span>Отображать</span>
                  <input
                    type="checkbox"
                    checked={visible(selected)}
                    disabled={!HIDEABLE_PARTS.includes(selected)}
                    onChange={() => toggle(selected)}
                  />
                </label>
                <div className="fs-prop fs-prop--top">
                  <span>Подсказка</span>
                  <p className="fs-hint">{FORM_PART_HINTS[selected]}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="fs-foot">
            <button
              type="button"
              className="fs-btn fs-btn--left"
              disabled={pending}
              onClick={() => {
                setDraft([]);
                setMessage("");
              }}
            >
              Стандартные
            </button>
            <span className="fs-message" role="status">
              {message}
            </span>
            <button type="button" className="fs-btn fs-btn--primary" disabled={pending} onClick={() => save(true)}>
              ОК
            </button>
            <Dialog.Close className="fs-btn" disabled={pending}>
              Отмена
            </Dialog.Close>
            <button type="button" className="fs-btn" disabled={pending} onClick={() => save(false)}>
              Применить
            </button>
          </div>

          <style>{`
            .fs-overlay { position: fixed; inset: 0; z-index: 60; background: rgba(31, 26, 20, 0.35); }
            .fs-dialog {
              position: fixed; z-index: 61; top: max(12px, 8dvh); left: 50%; transform: translateX(-50%);
              width: min(720px, calc(100vw - 24px)); max-height: calc(100dvh - 24px - max(12px, 8dvh)); overflow-y: auto;
              background: #fffcf6; border: 1px solid var(--color-border); border-radius: var(--radius-md);
              box-shadow: var(--shadow); padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;
            }
            .fs-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
            .fs-title { margin: 0; font-size: 17px; font-weight: 700; color: var(--color-text); }
            .fs-x {
              display: inline-flex; border: none; background: none; cursor: pointer; padding: 5px;
              border-radius: var(--radius-sm); color: var(--color-muted);
            }
            .fs-x:hover { color: var(--color-text); background: var(--color-muted-bg); }

            .fs-body { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            .fs-col { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
            .fs-col-title { margin: 0; font-size: 12.5px; color: var(--color-muted); }
            .fs-tree, .fs-props {
              min-height: 220px; padding: 6px; background: #fff; border: 1px solid var(--color-border-strong); border-radius: 4px;
            }
            .fs-node {
              display: flex; align-items: center; gap: 8px; padding: 3px 6px 3px 24px; border-radius: 3px;
              font-size: 13px; color: var(--color-text); cursor: pointer; outline: none;
            }
            .fs-node--root { padding-left: 6px; cursor: default; font-weight: 600; }
            .fs-node:not(.fs-node--root):hover { background: var(--color-muted-bg); }
            .fs-node--selected, .fs-node--selected:hover { background: #fde7b8; }
            .fs-node:focus-visible { box-shadow: 0 0 0 2px var(--color-accent); }
            .fs-node input { margin: 0; accent-color: var(--color-accent); }
            .fs-fixed { color: var(--color-success); }

            .fs-props { display: flex; flex-direction: column; gap: 8px; padding: 10px; }
            .fs-prop { display: grid; grid-template-columns: 110px 1fr; align-items: center; gap: 8px; font-size: 13px; color: var(--color-text); }
            .fs-prop--top { align-items: start; }
            .fs-prop input[type="checkbox"] { justify-self: start; margin: 0; accent-color: var(--color-accent); }
            .fs-input {
              padding: 4px 8px; font: inherit; font-size: 13px; color: var(--color-text);
              background: var(--color-muted-bg); border: 1px solid var(--color-border-strong); border-radius: 3px;
            }
            .fs-hint { margin: 0; font-size: 12.5px; color: var(--color-muted); line-height: 1.45; }

            .fs-foot { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 6px; }
            .fs-btn--left { margin-right: auto; }
            .fs-message { font-size: 12.5px; color: var(--color-success); margin-right: 6px; }
            .fs-btn {
              padding: 5px 14px; font: inherit; font-size: 13px; color: var(--color-text);
              background: #fff; border: 1px solid var(--color-border-strong); border-radius: 4px; cursor: pointer;
            }
            .fs-btn:hover { background: var(--color-muted-bg); }
            .fs-btn--primary { background: var(--color-accent); border-color: var(--color-accent); color: #fff; font-weight: 600; }
            .fs-btn--primary:hover { background: var(--color-accent-hover); }
            .fs-btn:disabled { opacity: 0.6; cursor: default; }

            @media (max-width: 560px) {
              .fs-body { grid-template-columns: 1fr; }
              .fs-tree, .fs-props { min-height: 0; }
            }
          `}</style>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
