"use client";

import { useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";

// Вложения: картинки грузятся сразу (/api/purchases/files) и видны превью; в форму уходят адреса файлов.
// customerId нужен, только когда кабинет открыл сотрудник («Просмотр»): клиенту id берётся из его сессии.

export type PickedFile = { url: string; name: string };

export default function FilePicker({
  customerId,
  value,
  onChange,
  max,
  label,
  onError,
}: {
  customerId: string;
  value: PickedFile[];
  onChange: (files: PickedFile[]) => void;
  max: number;
  label: string;
  onError: (message: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    onError(null);
    setUploading(true);
    const added: PickedFile[] = [];
    try {
      for (const file of Array.from(list).slice(0, max - value.length)) {
        const body = new FormData();
        body.append("file", file);
        body.append("customerId", customerId);
        const res = await fetch("/api/purchases/files", { method: "POST", body });
        const data = (await res.json().catch(() => ({}))) as { url?: string; name?: string; error?: string };
        if (!res.ok || !data.url) {
          onError(data.error ?? "Файл не загрузился");
          break;
        }
        added.push({ url: data.url, name: data.name ?? file.name });
      }
    } catch {
      onError("Файл не загрузился — проверьте связь");
    } finally {
      setUploading(false);
      if (added.length) onChange([...value, ...added]);
    }
  }

  return (
    <div className="bk-files">
      {value.map((file) => (
        <span key={file.url} className="bk-file" title={file.name}>
          {/* eslint-disable-next-line @next/next/no-img-element -- закрытые файлы: отдаёт /api/purchases/files */}
          <img src={file.url} alt={file.name} />
          <button type="button" aria-label="Убрать" onClick={() => onChange(value.filter((f) => f.url !== file.url))}>×</button>
        </span>
      ))}
      {value.length < max && (
        <label className="bk-add">
          {uploading ? <Loader2 size={18} className="bk-spin" /> : <ImagePlus size={18} />}
          {label}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple={max > 1} hidden disabled={uploading} onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
        </label>
      )}
    </div>
  );
}
