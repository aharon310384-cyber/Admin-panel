"use client";

// «Редактор панелей» — как в 1С: схема экрана, панели перетаскиваются в зоны сверху/слева/справа/снизу
// или в «неиспользуемые». Бросить на другую панель — встанет рядом с ней (в ту же строку или столбец),
// в пустое место зоны — новой строкой (сверху и снизу) или столбцом (слева и справа).
// Без мыши: нажать на панель, потом на другую панель или на пустое место зоны.
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { savePanels } from "@/actions/interface";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PANELS,
  MAX_GROUPS,
  PANEL_CODES,
  PANEL_LABELS,
  PANEL_ZONES,
  clonePanels,
  isVerticalZone,
  placedPanels,
  type PanelCode,
  type PanelLayout,
  type PanelZone,
} from "@/lib/interface";

type Target =
  | { kind: "beside"; anchor: PanelCode; after: boolean } // рядом с панелью, в ту же строку или столбец
  | { kind: "group"; zone: PanelZone } // новой строкой или столбцом в конце зоны
  | { kind: "unused" };

const ZONE_LABELS: Record<PanelZone, string> = { top: "сверху", left: "слева", right: "справа", bottom: "снизу" };

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

  const move = (code: PanelCode, target: Target) => {
    setLayout((prev) => {
      if (target.kind === "beside" && target.anchor === code) return prev;
      const next = clonePanels(prev);
      for (const zone of PANEL_ZONES) {
        next[zone] = next[zone].map((group) => group.filter((item) => item !== code)).filter((group) => group.length > 0);
      }
      if (target.kind === "group") {
        const groups = next[target.zone];
        if (groups.length < MAX_GROUPS) groups.push([code]);
        else groups[groups.length - 1].push(code);
      } else if (target.kind === "beside") {
        for (const zone of PANEL_ZONES) {
          for (const group of next[zone]) {
            const index = group.indexOf(target.anchor);
            if (index >= 0) {
              group.splice(target.after ? index + 1 : index, 0, code);
              return next;
            }
          }
        }
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

  // inTray — панель среди неиспользуемых; vertical — зона слева/справа (панели в столбце одна под другой).
  const chip = (code: PanelCode, inTray: boolean, vertical: boolean) => (
    <button
      key={code}
      type="button"
      draggable
      className={cn("pe-chip", selected === code && "pe-chip--selected", dragging === code && "pe-chip--dragging")}
      aria-pressed={selected === code}
      title="Перетащите на другую панель — встанет рядом, в пустое место — новой строкой"
      onClick={(e) => {
        e.stopPropagation();
        if (selected && selected !== code) move(selected, inTray ? { kind: "unused" } : { kind: "beside", anchor: code, after: true });
        else setSelected((current) => (current === code ? null : code));
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
        if (dragging && dragging !== code) {
          const rect = e.currentTarget.getBoundingClientRect();
          const after = vertical ? e.clientY > rect.top + rect.height / 2 : e.clientX > rect.left + rect.width / 2;
          move(dragging, inTray ? { kind: "unused" } : { kind: "beside", anchor: code, after });
        }
        setDragging(null);
      }}
    >
      {PANEL_LABELS[code]}
    </button>
  );

  // Обработчики пустого места: зона (новая строка/столбец) или лоток неиспользуемых.
  const dropArea = (target: Target, label: string) => ({
    role: "button" as const,
    tabIndex: 0,
    "aria-label": label,
    onClick: () => selected && move(selected, target),
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
      if ((e.key === "Enter" || e.key === " ") && selected && e.target === e.currentTarget) {
        e.preventDefault();
        move(selected, target);
      }
    },
    onDragOver: (e: React.DragEvent) => {
      if (dragging) e.preventDefault();
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragging) move(dragging, target);
      setDragging(null);
    },
  });

  const zone = (place: PanelZone) => {
    const vertical = isVerticalZone(place);
    return (
      <div
        className={cn("pe-zone", `pe-zone--${place}`, vertical && "pe-zone--vertical", moving && "pe-zone--target")}
        {...dropArea({ kind: "group", zone: place }, `Поставить выбранную панель ${ZONE_LABELS[place]} новой ${vertical ? "колонкой" : "строкой"}`)}
      >
        {layout[place].map((group) => (
          <div key={group.join("+")} className="pe-group">
            {group.map((code) => chip(code, false, vertical))}
          </div>
        ))}
        {/* Подсказка есть всегда, а видна только при перетаскивании — иначе окно сдвинулось бы под мышкой. */}
        <span className={cn("pe-new", moving && "pe-new--visible")} aria-hidden="true">
          {vertical ? "+ столбец" : "+ новая строка"}
        </span>
      </div>
    );
  };

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
            Перетащите панель на другую — встанет рядом с ней; в пустое место зоны — новой строкой; вниз — уберётся.
            Без мыши: нажмите на панель, потом на другую панель или на пустое место.
          </p>

          <div className="pe-screen">
            {zone("top")}
            {zone("left")}
            <div className="pe-work">Рабочая область</div>
            {zone("right")}
            {zone("bottom")}
          </div>

          <p className="pe-tray-label">Неиспользуемые панели</p>
          <div className={cn("pe-zone pe-tray", moving && "pe-zone--target")} {...dropArea({ kind: "unused" }, "Убрать выбранную панель в неиспользуемые")}>
            {unused.map((code) => chip(code, true, false))}
          </div>

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
              position: fixed; z-index: 61; top: max(12px, 6dvh); left: 50%; transform: translateX(-50%);
              width: min(680px, calc(100vw - 24px)); max-height: calc(100dvh - 24px - max(12px, 6dvh)); overflow-y: auto;
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
              display: grid; grid-template-columns: 150px 1fr 150px; gap: 6px; padding: 6px;
              border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm); background: #fff;
            }
            .pe-zone {
              min-height: 52px; padding: 6px; display: flex; flex-direction: column; gap: 6px; min-width: 0;
              border: 1px dashed var(--color-border-strong); border-radius: 6px; transition: border-color 0.15s, background 0.15s;
            }
            .pe-zone:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; }
            .pe-zone--top, .pe-zone--bottom { grid-column: 1 / -1; }
            .pe-zone--vertical { flex-direction: row; align-items: stretch; min-height: 170px; }
            .pe-group { display: flex; gap: 6px; min-width: 0; }
            .pe-group > .pe-chip { flex: 1 1 0; min-width: 0; }
            .pe-zone--vertical .pe-group { flex-direction: column; flex: 1 1 0; }
            .pe-new { align-self: flex-start; padding: 2px 4px; font-size: 11px; line-height: 1.2; color: var(--color-accent); visibility: hidden; }
            .pe-new--visible { visibility: visible; }
            .pe-work {
              display: flex; align-items: center; justify-content: center; min-height: 170px;
              border-radius: 6px; background: var(--color-muted-bg); color: var(--color-muted); font-size: 13px;
            }
            .pe-zone--target { border-color: var(--color-accent); background: oklch(52% 0.14 42 / 0.05); cursor: pointer; }

            .pe-tray-label { margin: 4px 0 0; font-size: 12px; font-weight: 600; color: var(--color-text-secondary); }
            .pe-tray { min-height: 64px; flex-direction: row; flex-wrap: wrap; align-content: flex-start; border-style: solid; border-color: transparent; background: #dcd6cc; }
            .pe-tray.pe-zone--target { border-color: var(--color-accent); background: #e6dfd4; }

            .pe-chip {
              padding: 8px 10px; max-width: 100%; text-align: left; font: inherit; font-size: 13px; line-height: 1.25;
              color: var(--color-text); background: #e9f2f8; border: 1px solid #a9c2d3; border-radius: 6px; cursor: grab;
            }
            .pe-tray .pe-chip { width: 168px; }
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
              .pe-screen { grid-template-columns: 96px 1fr 96px; }
              .pe-tray .pe-chip { width: 100%; }
            }
          `}</style>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
