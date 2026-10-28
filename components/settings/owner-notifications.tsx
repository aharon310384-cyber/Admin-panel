"use client";

// «Настройки» → «Оповещения владельцу»: каналы Telegram и WeChat (WeCom), ссылка бота группы WeCom (секрет — видно
// последние 4 знака), привязка своего Telegram кнопкой (одноразовая ссылка и QR-код), проверочное сообщение.

import { useEffect, useState, useTransition } from "react";
import { Bell, Link2, Loader2, Send, Unlink } from "lucide-react";
import {
  createOwnerTelegramLink,
  ownerChatStatus,
  removeWecomWebhook,
  saveOwnerChannels,
  saveWecomWebhook,
  sendOwnerTest,
  unlinkOwnerTelegram,
  type OwnerLink,
  type OwnerNotifyResult,
} from "@/actions/owner-notify";

export type OwnerNotificationsView = {
  telegramEnabled: boolean;
  wecomEnabled: boolean;
  wecomTail: string | null;
  ownerName: string | null;
  ownerLinked: boolean;
  ownerLinkedAt: string | null; // для показа
  ownerLinkedAtIso: string | null; // для сравнения: привязали заново — время другое
  botConfigured: boolean;
  lastSentAt: string | null;
  lastError: string | null;
};

export default function OwnerNotifications({ view, isAdmin }: { view: OwnerNotificationsView; isAdmin: boolean }) {
  const [channels, setChannels] = useState({ telegram: view.telegramEnabled, wecom: view.wecomEnabled });
  const [linked, setLinked] = useState({ on: view.ownerLinked, name: view.ownerName, at: view.ownerLinkedAtIso });
  const [link, setLink] = useState<Extract<OwnerLink, { ok: true }> | null>(null);
  const [webhook, setWebhook] = useState("");
  const [result, setResult] = useState<OwnerNotifyResult | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => setChannels({ telegram: view.telegramEnabled, wecom: view.wecomEnabled }), [view.telegramEnabled, view.wecomEnabled]);
  useEffect(
    () => setLinked({ on: view.ownerLinked, name: view.ownerName, at: view.ownerLinkedAtIso }),
    [view.ownerLinked, view.ownerName, view.ownerLinkedAtIso],
  );

  // Пока показана ссылка привязки — раз в 3 секунды спрашиваем, нажал ли владелец «Старт» в Telegram.
  useEffect(() => {
    if (!link) return;
    const timer = setInterval(async () => {
      const status = await ownerChatStatus();
      if (status.linked && status.at !== linked.at) {
        setLinked({ on: true, name: status.name, at: status.at });
        setChannels((c) => ({ ...c, telegram: true }));
        setLink(null);
        setResult({ ok: true, message: `Telegram привязан${status.name ? `: ${status.name}` : ""}` });
      }
    }, 3000);
    const stop = setTimeout(() => setLink(null), 10 * 60_000);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [link, linked.at]);

  const run = (name: string, action: () => Promise<OwnerNotifyResult | void>) => {
    setBusy(name);
    setResult(null);
    start(async () => {
      try {
        const r = await action();
        if (r) setResult(r);
      } catch {
        setResult({ ok: false, message: "Не получилось — попробуйте ещё раз" });
      } finally {
        setBusy(null);
      }
    });
  };
  const spinner = (name: string) => (busy === name ? <Loader2 size={14} className="on-spin" /> : null);
  const toggle = (channel: "telegram" | "wecom") => {
    const next = { ...channels, [channel]: !channels[channel] };
    setChannels(next);
    run("channels", () => saveOwnerChannels(next));
  };

  return (
    <div className="on">
      <p className="on-hint">
        Служебные сообщения только вам: посылки «требуют внимания» по итогу проверки 17TRACK, дальше — копии базы, новые клиенты,
        заявки. Клиентам отсюда ничего не уходит.
      </p>

      <div className="on-channel">
        <label className="on-check">
          <input type="checkbox" checked={channels.telegram} disabled={!isAdmin || pending} onChange={() => toggle("telegram")} />
          <b>Telegram</b>
        </label>
        <div className="on-body">
          {linked.on ? (
            <p className="on-state">Привязан: <b>{linked.name ?? "чат владельца"}</b>{view.ownerLinkedAt ? <span className="on-muted"> · {view.ownerLinkedAt}</span> : null}</p>
          ) : (
            <p className="on-state on-muted">Не привязан — сообщениям некуда идти</p>
          )}
          {isAdmin && (
            <div className="on-actions">
              <button
                type="button"
                className="on-btn"
                disabled={pending || !view.botConfigured}
                title={view.botConfigured ? undefined : "Бот Telegram на сервере не настроен"}
                onClick={() =>
                  run("link", async () => {
                    const r = await createOwnerTelegramLink();
                    if (r.ok) setLink(r);
                    else return { ok: false, message: r.message };
                  })
                }
              >
                {spinner("link") ?? <Link2 size={14} />} {linked.on ? "Привязать другой Telegram" : "Привязать мой Telegram"}
              </button>
              {linked.on && (
                <button type="button" className="on-btn" disabled={pending} onClick={() => run("unlink", async () => {
                  const r = await unlinkOwnerTelegram();
                  setLinked({ on: false, name: null, at: null });
                  setChannels((c) => ({ ...c, telegram: false }));
                  return r;
                })}>
                  {spinner("unlink") ?? <Unlink size={14} />} Отвязать
                </button>
              )}
            </div>
          )}
          {link && (
            <div className="on-link">
              <div className="on-qr" dangerouslySetInnerHTML={{ __html: link.qr }} />
              <ol>
                <li>Откройте ссылку на телефоне или в Telegram на компьютере: <a href={link.url} target="_blank" rel="noreferrer">{link.url}</a> — или наведите камеру телефона на QR-код.</li>
                <li>В Telegram нажмите «Старт».</li>
                <li>Здесь появится «Привязан» — сообщения пойдут в этот чат.</li>
              </ol>
              <p className="on-muted">Ссылка действует {link.minutes} минут и срабатывает один раз. Ждём «Старт»… <Loader2 size={12} className="on-spin" /></p>
            </div>
          )}
        </div>
      </div>

      <div className="on-channel">
        <label className="on-check">
          <input type="checkbox" checked={channels.wecom} disabled={!isAdmin || pending || !view.wecomTail} onChange={() => toggle("wecom")} />
          <b>WeChat (WeCom)</b>
        </label>
        <div className="on-body">
          {view.wecomTail ? (
            <p className="on-state">Ссылка бота группы: <span className="on-mono">…{view.wecomTail}</span></p>
          ) : (
            <p className="on-state on-muted">Ссылка бота группы WeCom не задана</p>
          )}
          {isAdmin && (
            <form
              className="on-actions"
              onSubmit={(e) => {
                e.preventDefault();
                run("wecom", async () => {
                  const r = await saveWecomWebhook(webhook);
                  if (r.ok) setWebhook("");
                  return r;
                });
              }}
            >
              <input
                type="password"
                className="on-input"
                value={webhook}
                onChange={(e) => setWebhook(e.target.value)}
                placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…"
                autoComplete="off"
                aria-label="Ссылка бота WeCom"
              />
              <button type="submit" className="on-btn" disabled={pending || !webhook.trim()}>
                {spinner("wecom")} {view.wecomTail ? "Заменить" : "Сохранить"}
              </button>
              {view.wecomTail && (
                <button type="button" className="on-btn on-btn--danger" disabled={pending} onClick={() => run("wecom-remove", removeWecomWebhook)}>
                  {spinner("wecom-remove")} Удалить
                </button>
              )}
            </form>
          )}
          <p className="on-muted on-small">WeCom: группа → ⋯ → «Message Push» (消息推送) → ссылка бота. При сохранении в группу уходит сообщение-проверка.</p>
        </div>
      </div>

      {isAdmin && (
        <div className="on-actions">
          <button type="button" className="on-btn" disabled={pending} onClick={() => run("test", sendOwnerTest)}>
            {spinner("test") ?? <Send size={14} />} Отправить проверочное сообщение
          </button>
        </div>
      )}
      {result && <p className={result.ok ? "on-ok" : "on-error"} role="status">{result.message}</p>}
      {(view.lastSentAt || view.lastError) && (
        <p className="on-muted on-small">
          <Bell size={12} /> Последнее оповещение: {view.lastSentAt ?? "—"}
          {view.lastError ? <span className="on-error"> · {view.lastError}</span> : null}
        </p>
      )}

      <style>{`
        .on { display: flex; flex-direction: column; gap: 12px; font-size: 13px; }
        .on-hint { margin: 0; color: var(--color-text-secondary); line-height: 1.5; }
        .on-channel { display: grid; grid-template-columns: 150px 1fr; gap: 6px 12px; padding-top: 10px; border-top: 1px solid var(--color-border); }
        .on-check { display: inline-flex; align-items: center; gap: 6px; align-self: start; cursor: pointer; }
        .on-check input { accent-color: var(--color-accent); }
        .on-body { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .on-state { margin: 0; }
        .on-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
        .on-btn { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 12px; border: 1px solid var(--color-border-strong); border-radius: 4px; background: #fff; color: var(--color-text); font: inherit; cursor: pointer; white-space: nowrap; }
        .on-btn:hover:not(:disabled) { background: var(--color-muted-bg); }
        .on-btn:disabled { opacity: 0.6; cursor: default; }
        .on-btn--danger { color: var(--color-danger); }
        .on-input { flex: 1; min-width: 200px; height: 28px; padding: 0 8px; font: inherit; border: 1px solid var(--color-border-strong); border-radius: 4px; background: #fff; }
        .on-link { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; padding: 10px; border: 1px dashed var(--color-border-strong); border-radius: 6px; background: #fffdf8; }
        .on-qr { width: 168px; height: 168px; flex-shrink: 0; background: #fff; }
        .on-qr svg { width: 100%; height: 100%; display: block; }
        .on-link ol { margin: 0; padding-left: 18px; flex: 1; min-width: 220px; line-height: 1.6; }
        .on-link a { color: var(--color-accent); word-break: break-all; }
        .on-link p { margin: 0; flex-basis: 100%; }
        .on-muted { color: var(--color-muted); }
        .on-small { margin: 0; font-size: 12px; display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap; }
        .on-mono { font-family: var(--font-mono); }
        .on-ok { margin: 0; color: var(--color-success); font-weight: 600; }
        .on-error { margin: 0; color: var(--color-danger); }
        .on-spin { animation: on-spin 1s linear infinite; }
        @keyframes on-spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) { .on-channel { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
