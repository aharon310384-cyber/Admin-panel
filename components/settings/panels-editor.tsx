"use client";

// «Редактор панелей» — как в 1С: схема экрана, панели перетаскиваются в зоны сверху/слева/справа/снизу
// или в «неиспользуемые». Без мыши: нажать на панель, потом на зону.
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { savePanels } from "@/actions/interface";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PANELS,
  PANEL_CODES,
  PANEL_LABELS,
  PANEL_ZONES,
  clonePanels,
  placedPanels,
  type PanelCode,
  type PanelLayout,
  type PanelZone,
} from "@/lib/interface";

type Place = PanelZone | "unused";

const PLACE_LABELS: Record<Place, string> = {
  top: "сверху",
  left: "слева",
  right: "справа",
  bottom: "снизу",
  unused: "в неиспользуемые",
};

export default function PanelsEditor({
  open,
  onOpenChange,
  saved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saved: PanelLayout;
}) {
  const router = useRouter();
  const [layout, setLayout] = useState(() => clonePanels(saved));
  const [selected, setSelected] = useState<PanelCode | null>(null);
  const [dragging, setDragging] = useState<PanelCode | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  // Каждый раз окно открывается с сохранённой настройкой. Пока окно открыто, «Применить» его не сбрасывает.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setLayout(clonePanels(saved));
      setSelected(null);
      setMessage("");
    }
    wasOpen.current = open;
  }, [open, saved]);

  const placed = placedPanels(layout);
  const unused = PANEL_CODES.filter((code) => !placed.has(code));
  const moving = dragging ?? selected;

  const move = (code: PanelCode, place: Place, before?: PanelCode) => {
    setLayout((prev) => {
      const next = clonePanels(prev);
      for (const zone of PANEL_ZONES) next[zone] = next[zone].filter((item) => item !== code);
      if (place !== "unused") {
        const index = before ? next[place].indexOf(before) : -1;
        if (index >= 0) next[place].splice(index, 0, code);
        else next[place].push(code);
      }
      return next;
    });
    setSelected(null);
    setMessage("");
  };

  const save = (close: boolean) =>
    startTransition(async () => {
      // Совпадает со стандартной — храним «стандартные», чтобы подхватывать их будущие изменения.
      const isDefault = JSON.stringify(layout) === JSON.stringify(DEFAULT_PANELS);
      const result = await savePanels(isDefault ? null : layout);
      if (result && "error" in result && result.error) {
        setMessage(result.error);
        return;
      }
      router.refresh();
      if (close) onOpenChange(false);
      else setMessage("Применено");
    });

  const chip = (code: PanelCode, place: Place) => (
    <button
      key={code}
      type="button"
      draggable
      className={cn("pe-chip", selected === code && "pe-chip--selected", dragging === code && "pe-chip--dragging")}
      aria-pressed={selected === code}
      title="Перетащите в нужное место или нажмите, а потом нажмите на зону"
      onClick={(e) => {
        e.stopPropagation();
        setSelected((current) => (current === code ? null : code));
      }}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", code);
        e.dataTransfer.effectAllowed = "move";
        setDragging(code);
      }}
      onDragEnd={() => setDragging(null)}
      onDragOver={(e) => {
        if (dragging) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dragging && dragging !== code) move(dragging, place, code);
        setDragging(null);
      }}
    >
      {PANEL_LABELS[code]}
    </button>
  );

  const zone = (place: Place, codes: PanelCode[], className: string) => (
    <div
      className={cn("pe-zone", className, moving && "pe-zone--target")}
      role="button"
      tabIndex={0}
      aria-label={`Поставить выбранную панель ${PLACE_LABELS[place]}`}
      onClick={() => selected && move(selected, place)}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && selected && e.target === e.currentTarget) {
          e.preventDefault();
          move(selected, place);
        }
      }}
      onDragOver={(e) => {
        if (dragging) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (dragging) move(dragging, place);
        setDragging(null);
      }}
    >
      {codes.map((code) => chip(code, place))}
    </div>
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="pe-overlay" />
        <Dialog.Content className="pe-dialog" aria-describedby="pe-hint">
          <div className="pe-head">
            <Dialog.Title className="pe-title">Редактор панелей</Dialog.Title>
            <Dialog.Close className="pe-x" aria-label="Закрыть">
              <X size={18} />
            </Dialog.Close>
          </div>
          <p id="pe-hint" className="pe-hint">
            Перетащите панель в нужное место экрана или уберите вниз, в неиспользуемые. Без мыши: нажмите на панель, потом на место.
          </p>

          <div className="pe-screen">
            {zone("top", layout.top, "pe-zone--top")}
            {zone("left", layout.left, "pe-zone--left")}
            <div className="pe-work">Рабочая область</div>
            {zone("right", layout.right, "pe-zone--right")}
            {zone("bottom", layout.bottom, "pe-zone--bottom")}
          </div>

          <p className="pe-tray-label">Неиспользуемые панели</p>
          {zone("unused", unused, "pe-tray")}

          <div className="pe-foot">
            <span className="pe-message" role="status">
              {message}
            </span>
            <button type="button" className="pe-btn pe-btn--primary" disabled={pending} onClick={() => save(true)}>
              ОК
            </button>
            <Dialog.Close className="pe-btn" disabled={pending}>
              Отмена
            </Dialog.Close>
            <button type="button" className="pe-btn" disabled={pending} onClick={() => save(false)}>
              Применить
            </button>
            <button
              type="button"
              className="pe-btn"
              disabled={pending}
              onClick={() => {
                setLayout(clonePanels(DEFAULT_PANELS));
                setSelected(null);
                setMessage("");
              }}
            >
              Стандартные
            </button>
          </div>

          <style>{`
            .pe-overlay { position: fixed; inset: 0; z-index: 60; background: rgba(31, 26, 20, 0.35); }
            .pe-dialog {
              position: fixed; z-index: 61; top: 50%; left: 50%; transform: translate(-50%, -50%);
              width: min(680px, calc(100vw - 24px)); max-height: calc(100dvh - 24px); overflow-y: auto;
              background: #fffcf6; border: 1px solid var(--color-border); border-radius: var(--radius-md);
              box-shadow: var(--shadow); padding: 18px 20px 16px; display: flex; flex-direction: column; gap: 10px;
            }
            .pe-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
            .pe-title { margin: 0; font-size: 18px; font-weight: 700; color: var(--color-text); }
            .pe-x {
              display: inline-flex; border: none; background: none; cursor: pointer; padding: 6px;
              border-radius: var(--radius-sm); color: var(--color-muted);
            }
            .pe-x:hover { color: var(--color-text); background: var(--color-muted-bg); }
            .pe-hint { margin: 0; font-size: 12.5px; color: var(--color-muted); }

            .pe-screen {
              display: grid; grid-template-columns: 128px 1fr 128px; gap: 6px; padding: 6px;
              border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm); background: #fff;
            }
            .pe-zone {
              min-height: 52px; padding: 6px; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 6px;
              border: 1px dashed var(--color-border-strong); border-radius: 6px; transition: border-color 0.15s, background 0.15s;
            }
            .pe-zone:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; }
            .pe-zone--top, .pe-zone--bottom { grid-column: 1 / -1; }
            .pe-zone--left, .pe-zone--right { flex-direction: column; flex-wrap: nowrap; min-height: 170px; }
            .pe-work {
              display: flex; align-items: center; justify-content: center; min-height: 170px;
              border-radius: 6px; background: var(--color-muted-bg); color: var(--color-muted); font-size: 13px;
            }
            .pe-zone--target { border-color: var(--color-accent); background: oklch(52% 0.14 42 / 0.05); cursor: pointer; }

            .pe-tray-label { margin: 4px 0 0; font-size: 12px; font-weight: 600; color: var(--color-text-secondary); }
            .pe-tray { min-height: 64px; border-style: solid; border-color: transparent; background: #dcd6cc; }
            .pe-tray.pe-zone--target { border-color: var(--color-accent); background: #e6dfd4; }

            .pe-chip {
              padding: 8px 10px; max-width: 100%; text-align: left; font: inherit; font-size: 13px; line-height: 1.25;
              color: var(--color-text); background: #e9f2f8; border: 1px solid #a9c2d3; border-radius: 6px; cursor: grab;
            }
            .pe-zone--top .pe-chip, .pe-zone--bottom .pe-chip, .pe-tray .pe-chip { width: 168px; }
            .pe-zone--top .pe-chip:only-child, .pe-zone--bottom .pe-chip:only-child { width: 100%; }
            .pe-chip:hover { border-color: #7ea3bb; }
            .pe-chip--selected { outline: 2px solid var(--color-accent); outline-offset: 1px; }
            .pe-chip--dragging { opacity: 0.45; }

            .pe-foot { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
            .pe-message { margin-right: auto; font-size: 12.5px; color: var(--color-success); }
            .pe-btn {
              padding: 8px 14px; font: inherit; font-size: 13px; font-weight: 500; color: var(--color-text);
              background: transparent; border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm); cursor: pointer;
            }
            .pe-btn:hover { background: var(--color-muted-bg); }
            .pe-btn--primary { background: var(--color-accent); border-color: var(--color-accent); color: #fff; font-weight: 600; }
            .pe-btn--primary:hover { background: var(--color-accent-hover); }
            .pe-btn:disabled { opacity: 0.6; cursor: default; }

            @media (max-width: 560px) {
              .pe-screen { grid-template-columns: 92px 1fr 92px; }
              .pe-zone--top .pe-chip, .pe-zone--bottom .pe-chip, .pe-tray .pe-chip { width: 100%; }
            }
          `}</style>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
