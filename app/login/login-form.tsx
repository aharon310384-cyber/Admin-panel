"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, LogIn, Loader2 } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(6, "Пароль не менее 6 символов"),
});

type FormData = z.infer<typeof schema>;

export default function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      toast.error("Неверный email или пароль");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="login-form">
      <div className="field-group">
        <div className="field">
          <label htmlFor="email" className="field-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={`field-input ${errors.email ? "field-input--error" : ""}`}
            placeholder="admin@shop.ru"
            {...register("email")}
          />
          {errors.email && (
            <p className="field-error">{errors.email.message}</p>
          )}
        </div>

        <div className="field">
          <label htmlFor="password" className="field-label">
            Пароль
          </label>
          <div className="field-input-wrap">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className={`field-input field-input--with-icon ${errors.password ? "field-input--error" : ""}`}
              placeholder="••••••••"
              {...register("password")}
            />
            <button
              type="button"
              className="field-eye-btn"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="field-error">{errors.password.message}</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-primary btn-full"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={16} className="spin" />
            Вход...
          </>
        ) : (
          <>
            <LogIn size={16} />
            Войти
          </>
        )}
      </button>

      <style>{`
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .field-group {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text);
        }

        .field-input {
          width: 100%;
          padding: 10px 14px;
          background: oklch(99% 0.008 65 / 0.6);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 14px;
          color: var(--color-text);
          font-family: var(--font-sans);
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none;
        }

        .field-input:focus {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px oklch(52% 0.14 42 / 0.12);
        }

        .field-input--error {
          border-color: var(--color-danger);
        }

        .field-input--error:focus {
          box-shadow: 0 0 0 3px oklch(52% 0.18 22 / 0.12);
        }

        .field-input-wrap {
          position: relative;
        }

        .field-input--with-icon {
          padding-right: 42px;
        }

        .field-eye-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: var(--color-muted);
          padding: 4px;
          display: flex;
          align-items: center;
          transition: color 0.15s;
        }

        .field-eye-btn:hover {
          color: var(--color-text);
        }

        .field-error {
          font-size: 12px;
          color: var(--color-danger);
        }

        .btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 11px 20px;
          background: var(--color-accent);
          color: var(--color-accent-fg);
          border: none;
          border-radius: var(--radius-sm);
          font-size: 14px;
          font-weight: 500;
          font-family: var(--font-sans);
          cursor: pointer;
          transition: background 0.15s, opacity 0.15s;
        }

        .btn-primary:hover {
          background: var(--color-accent-hover);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-full {
          width: 100%;
        }

        .spin {
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </form>
  );
}
