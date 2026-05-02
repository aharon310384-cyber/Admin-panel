"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Введите текущий пароль"),
    newPassword: z.string().min(6, "Новый пароль не менее 6 символов"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export default function ChangePasswordForm() {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch("/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error ?? "Ошибка при смене пароля");
        return;
      }

      toast.success("Пароль успешно изменён");
      reset();
    } catch {
      toast.error("Ошибка при смене пароля");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="pw-form">
      <div className="field">
        <label className="field-label">Текущий пароль</label>
        <div className="field-wrap">
          <input
            type={showCurrent ? "text" : "password"}
            {...register("currentPassword")}
            className={`field-input ${errors.currentPassword ? "err" : ""}`}
            placeholder="••••••••"
          />
          <button type="button" className="eye-btn" onClick={() => setShowCurrent((v) => !v)}>
            {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {errors.currentPassword && <p className="field-error">{errors.currentPassword.message}</p>}
      </div>

      <div className="field">
        <label className="field-label">Новый пароль</label>
        <div className="field-wrap">
          <input
            type={showNew ? "text" : "password"}
            {...register("newPassword")}
            className={`field-input ${errors.newPassword ? "err" : ""}`}
            placeholder="••••••••"
          />
          <button type="button" className="eye-btn" onClick={() => setShowNew((v) => !v)}>
            {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {errors.newPassword && <p className="field-error">{errors.newPassword.message}</p>}
      </div>

      <div className="field">
        <label className="field-label">Подтвердите пароль</label>
        <input
          type="password"
          {...register("confirmPassword")}
          className={`field-input ${errors.confirmPassword ? "err" : ""}`}
          placeholder="••••••••"
        />
        {errors.confirmPassword && <p className="field-error">{errors.confirmPassword.message}</p>}
      </div>

      <button type="submit" disabled={isSubmitting} className="btn-primary">
        {isSubmitting ? <Loader2 size={15} className="spin" /> : null}
        {isSubmitting ? "Сохранение..." : "Сменить пароль"}
      </button>

      <style>{`
        .pw-form { display: flex; flex-direction: column; gap: 14px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field-label { font-size: 13px; font-weight: 500; color: var(--color-text); }
        .field-wrap { position: relative; }
        .field-input { width: 100%; padding: 10px 14px; background: oklch(99% 0.008 65 / 0.6); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13.5px; color: var(--color-text); font-family: var(--font-sans); outline: none; transition: border-color 0.15s; }
        .field-input:focus { border-color: var(--color-accent); }
        .field-input.err { border-color: var(--color-danger); }
        .field-input.err:focus { box-shadow: 0 0 0 3px oklch(52% 0.18 22 / 0.1); }
        .eye-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--color-muted); padding: 4px; display: flex; transition: color 0.15s; }
        .eye-btn:hover { color: var(--color-text); }
        .field-error { font-size: 12px; color: var(--color-danger); }
        .btn-primary { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 20px; background: var(--color-accent); color: var(--color-accent-fg); border: none; border-radius: var(--radius-sm); font-size: 13.5px; font-weight: 500; cursor: pointer; font-family: var(--font-sans); transition: background 0.15s; }
        .btn-primary:hover { background: var(--color-accent-hover); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </form>
  );
}
