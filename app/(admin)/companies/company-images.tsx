"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { CompanyImage } from "@/lib/brand";

// Логотип и знак компании: загрузить или убрать. Сохраняются сразу, без кнопки «Сохранить» формы.

const MAX_SIZE = 2 * 1024 * 1024;

const IMAGES: { kind: CompanyImage; label: string; hint: string; width: number; height: number }[] = [
  { kind: "logo", label: "Логотип", hint: "С надписью, вытянутый. Шапка и боковая панель кабинета.", width: 150, height: 49 },
  { kind: "icon", label: "Знак", hint: "Без надписи, почти квадрат. Рядом с названием: вход в кабинет, шапка админки.", width: 52, height: 52 },
];

type Props = {
  companyId: string;
  urls: Record<CompanyImage, string | null>;
  isAdmin: boolean;
};

export default function CompanyImages({ companyId, urls, isAdmin }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<CompanyImage | null>(null);
  const inputs = useRef<Partial<Record<CompanyImage, HTMLInputElement | null>>>({});

  async function send(kind: CompanyImage, file: File | null) {
    if (file && file.size > MAX_SIZE) {
      toast.error("Файл больше 2 МБ — уменьшите картинку");
      return;
    }
    setBusy(kind);
    try {
      const body = file ? new FormData() : undefined;
      if (file) body!.append("file", file);
      const response = await fetch(`/api/company/${companyId}/${kind}`, { method: file ? "POST" : "DELETE", body });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        toast.error(result.error ?? "Не получилось — попробуйте ещё раз");
        return;
      }
      toast.success(file ? "Картинка сохранена" : "Картинка убрана");
      router.refresh();
    } catch {
      toast.error("Не получилось — попробуйте ещё раз");
    } finally {
      setBusy(null);
      const input = inputs.current[kind];
      if (input) input.value = "";
    }
  }

  return (
    <section className="card company-images">
      <h2 className="section-title">Логотип</h2>
      <div className="ci-grid">
        {IMAGES.map(({ kind, label, hint, width, height }) => (
          <div key={kind} className="ci-item">
            <span className="field-label">{label}</span>
            <div className="ci-preview">
              {urls[kind] ? (
                <Image src={urls[kind]!} alt={label} width={width} height={height} unoptimized className={`ci-img ci-img--${kind}`} />
              ) : (
                <span className="ci-empty">нет</span>
              )}
            </div>
            <p className="field-hint">{hint} PNG, JPEG или WebP, до 2 МБ.</p>
            {isAdmin && (
              <div className="ci-actions">
                <input
                  ref={(element) => {
                    inputs.current[kind] = element;
                  }}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void send(kind, file);
                  }}
                />
                <button type="button" className="ci-btn" disabled={busy !== null} onClick={() => inputs.current[kind]?.click()}>
                  {busy === kind ? <Loader2 size={14} className="spin" /> : <ImageUp size={14} />}
                  Загрузить
                </button>
                {urls[kind] && (
                  <button
                    type="button"
                    className="ci-btn ci-btn--danger"
                    disabled={busy !== null}
                    onClick={() => {
                      if (confirm(`Убрать ${label.toLowerCase()}?`)) void send(kind, null);
                    }}
                  >
                    <Trash2 size={14} />
                    Убрать
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .company-images { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 14px 16px; box-shadow: var(--shadow-card); }
        .ci-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .ci-item { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
        .ci-preview { display: flex; align-items: center; justify-content: center; height: 84px; border: 1px dashed var(--color-border); border-radius: var(--radius-sm); background: var(--color-muted-bg); }
        .ci-img { width: auto; object-fit: contain; }
        .ci-img--logo { height: 49px; max-width: 90%; }
        .ci-img--icon { height: 52px; }
        .ci-empty { font-size: 12px; color: var(--color-muted); }
        .ci-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .ci-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text); font: inherit; font-size: 13px; cursor: pointer; }
        .ci-btn:hover:not(:disabled) { background: var(--color-muted-bg); }
        .ci-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .ci-btn--danger { color: var(--color-danger); }
        @media (max-width: 640px) { .ci-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
