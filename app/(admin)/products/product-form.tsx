"use client";

/* eslint-disable @next/next/no-img-element */

import { useActionState, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Loader2, Upload, X } from "lucide-react";
import { slugify } from "@/lib/utils";
import { toast } from "sonner";
import type { Product } from "@prisma/client";

type FormState = { error?: Record<string, string[]> };
type ActionFn = (formData: FormData) => Promise<FormState | void>;

type Props = {
  action: ActionFn;
  product?: Product;
};

export default function ProductForm({ action, product }: Props) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    async (_state, formData) => (await action(formData)) ?? {},
    {}
  );
  const [name, setName] = useState(product?.name ?? "");
  const [slugValue, setSlugValue] = useState(product?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(!!product);
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!slugEdited && name) {
      setSlugValue(slugify(name));
    }
  }, [name, slugEdited]);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Ошибка загрузки");
        return;
      }
      setImageUrl(json.url);
      toast.success("Изображение загружено");
    } catch {
      toast.error("Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  };

  const errors = state?.error;

  return (
    <form action={formAction} className="product-form">
      <div className="card">
        <h2 className="section-title">Основная информация</h2>

        <div className="field-grid">
          <div className="field field--full">
            <label className="field-label">
              Название услуги <span className="required">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`field-input ${errors?.name ? "field-input--error" : ""}`}
              placeholder="Авиа доставка 1 кг"
            />
            {errors?.name && <p className="field-error">{errors.name[0]}</p>}
          </div>

          <div className="field">
            <label className="field-label">Slug (URL)</label>
            <input
              type="text"
              name="slug"
              value={slugValue}
              onChange={(e) => {
                setSlugValue(e.target.value);
                setSlugEdited(true);
              }}
              className="field-input"
              placeholder="avia-dostavka-1kg"
            />
            <p className="field-hint">Автозаполняется из названия</p>
          </div>

          <div className="field">
            <label className="field-label">
              Код <span className="required">*</span>
            </label>
            <input
              type="text"
              name="sku"
              defaultValue={product?.sku ?? ""}
              className={`field-input mono ${errors?.sku ? "field-input--error" : ""}`}
              placeholder="SVC-AIR-1KG"
            />
            {errors?.sku && <p className="field-error">{errors.sku[0]}</p>}
          </div>

          <div className="field">
            <label className="field-label">
              Тариф, $ <span className="required">*</span>
            </label>
            <input
              type="number"
              name="price"
              defaultValue={product ? Number(product.price) : ""}
              min="0"
              step="0.01"
              className={`field-input ${errors?.price ? "field-input--error" : ""}`}
              placeholder="99.00"
            />
            {errors?.price && <p className="field-error">{errors.price[0]}</p>}
          </div>

          <div className="field">
            <label className="field-label">Доступный лимит</label>
            <input
              type="number"
              name="stock"
              defaultValue={product?.stock ?? 0}
              min="0"
              className="field-input"
              placeholder="0"
            />
          </div>

          <div className="field field--full">
            <label className="field-label">Описание</label>
            <textarea
              name="description"
              defaultValue={product?.description ?? ""}
              className="field-input field-textarea"
              placeholder="Краткое описание услуги..."
              rows={3}
            />
          </div>

          <div className="field field--full">
            <label className="field-label">Изображение услуги</label>
            <div className="image-upload">
              {imageUrl && (
                <div className="image-preview">
                  <img src={imageUrl} alt="Превью" />
                  <button
                    type="button"
                    className="image-remove"
                    onClick={() => setImageUrl("")}
                    aria-label="Удалить изображение"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="image-controls">
                <input
                  type="hidden"
                  name="imageUrl"
                  value={imageUrl}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="file-input-hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
                <button
                  type="button"
                  className="btn-upload"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                  {uploading ? "Загрузка..." : "Загрузить файл"}
                </button>
                <span className="image-or">или</span>
                <input
                  type="url"
                  className="field-input field-input--url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          <div className="field field--checkbox">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={product?.isActive ?? true}
                className="checkbox-input"
              />
              <span className="checkbox-text">Услуга активна</span>
            </label>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <Link href="/products" className="btn-secondary">
          Отмена
        </Link>
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? (
            <>
              <Loader2 size={15} className="spin" />
              Сохранение...
            </>
          ) : (
            product ? "Сохранить изменения" : "Создать услугу"
          )}
        </button>
      </div>

      <style>{`
        .product-form { display: flex; flex-direction: column; gap: 20px; }

        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 24px; box-shadow: var(--shadow-card); }

        .section-title { font-size: 15px; font-weight: 600; margin: 0 0 20px; color: var(--color-text); }

        .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field--full { grid-column: 1 / -1; }
        .field--checkbox { justify-content: flex-end; padding-bottom: 4px; }

        .field-label { font-size: 13px; font-weight: 500; color: var(--color-text); }
        .required { color: var(--color-danger); }

        .field-input { padding: 10px 14px; background: oklch(99% 0.008 65 / 0.6); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 14px; color: var(--color-text); font-family: var(--font-sans); outline: none; transition: border-color 0.15s; }
        .field-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px oklch(52% 0.14 42 / 0.1); }
        .field-input--error { border-color: var(--color-danger); }
        .field-textarea { resize: vertical; min-height: 80px; font-family: var(--font-sans); line-height: 1.5; }
        .mono { font-family: var(--font-mono); }

        .field-error { font-size: 12px; color: var(--color-danger); }
        .field-hint { font-size: 11px; color: var(--color-muted); }

        .image-upload { display: flex; flex-direction: column; gap: 10px; }
        .image-preview { position: relative; width: 100px; height: 100px; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--color-border); }
        .image-preview img { width: 100%; height: 100%; object-fit: cover; }
        .image-remove { position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.5); border: none; border-radius: 4px; color: white; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .image-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .file-input-hidden { display: none; }
        .btn-upload { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; color: var(--color-text); cursor: pointer; font-family: var(--font-sans); white-space: nowrap; transition: background 0.15s; }
        .btn-upload:hover { background: var(--color-muted-bg); }
        .btn-upload:disabled { opacity: 0.6; cursor: not-allowed; }
        .image-or { font-size: 12px; color: var(--color-muted); white-space: nowrap; }
        .field-input--url { flex: 1; min-width: 200px; }

        .checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .checkbox-input { width: 16px; height: 16px; accent-color: var(--color-accent); cursor: pointer; }
        .checkbox-text { font-size: 13px; font-weight: 500; color: var(--color-text); }

        .form-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }

        .btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; background: var(--color-accent); color: var(--color-accent-fg); border: none; border-radius: var(--radius-sm); font-size: 14px; font-weight: 500; cursor: pointer; font-family: var(--font-sans); transition: background 0.15s; }
        .btn-primary:hover { background: var(--color-accent-hover); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        .btn-secondary { display: inline-flex; align-items: center; padding: 10px 20px; background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 14px; font-weight: 500; color: var(--color-text); text-decoration: none; transition: background 0.15s; }
        .btn-secondary:hover { background: var(--color-muted-bg); }

        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 640px) { .field-grid { grid-template-columns: 1fr; } }
      `}</style>
    </form>
  );
}
