"use client";

import { useState } from "react";
import { KeyRound, Copy, Check } from "lucide-react";
import { resetClientPassword } from "@/actions/client-password";

export default function SetPasswordButton({ customerId }: { customerId: string }) {
  const [password, setPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const run = async () => {
    if (loading) return;
    setLoading(true);
    const r = await resetClientPassword(customerId);
    setLoading(false);
    if (r.ok && r.password) {
      setPassword(r.password);
      setCopied(false);
    }
  };

  const copy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="spb">
      <button type="button" className="spb-btn" onClick={run} disabled={loading}>
        <KeyRound size={15} />
        {loading ? "Генерация…" : password ? "Сбросить пароль" : "Задать пароль"}
      </button>

      {password && (
        <div className="spb-result">
          <span className="spb-label">Пароль клиента (покажите один раз):</span>
          <div className="spb-pwd">
            <code>{password}</code>
            <button type="button" className="spb-copy" onClick={copy} aria-label="Скопировать">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .spb { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
        .spb-btn {
          display: inline-flex; align-items: center; gap: 7px; padding: 9px 14px;
          border: 1px solid var(--color-border); border-radius: var(--radius-sm);
          background: var(--color-surface); color: var(--color-text);
          font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;
          transition: background 0.15s, border-color 0.15s;
        }
        .spb-btn:hover { background: var(--color-muted-bg); border-color: var(--color-text-secondary); }
        .spb-btn:disabled { opacity: 0.6; cursor: default; }
        .spb-result {
          display: flex; flex-direction: column; gap: 6px; padding: 12px 14px;
          border-radius: var(--radius-md); background: var(--color-muted-bg);
          border: 1px solid var(--color-border);
        }
        .spb-label { font-size: 12px; color: var(--color-muted); }
        .spb-pwd { display: flex; align-items: center; gap: 10px; }
        .spb-pwd code {
          font-family: var(--font-mono); font-size: 16px; font-weight: 700; letter-spacing: 0.06em;
          color: var(--color-text);
        }
        .spb-copy {
          display: inline-flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: var(--radius-sm);
          border: 1px solid var(--color-border); background: var(--color-surface);
          color: var(--color-muted); cursor: pointer; transition: color 0.15s, border-color 0.15s;
        }
        .spb-copy:hover { color: var(--color-accent); border-color: var(--color-accent); }
      `}</style>
    </div>
  );
}
