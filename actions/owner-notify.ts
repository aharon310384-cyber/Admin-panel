"use server";

// «Настройки» → «Оповещения владельцу»: каналы, ссылка бота WeCom (секрет), привязка Telegram владельца
// одноразовой ссылкой и проверочное сообщение. Меняет только администратор.

import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-helpers";
import { getTelegramBotName, isTelegramConfigured } from "@/lib/telegram";
import {
  ensureOwnerSettings,
  getOwnerSettings,
  LINK_CODE_MINUTES,
  newOwnerLinkCode,
  notifyOwner,
  OWNER_START,
  sendWecom,
  WECOM_WEBHOOK_RE,
  type ChannelResult,
} from "@/lib/owner-notify";

export type OwnerNotifyResult = { ok: boolean; message: string };
export type OwnerLink = { ok: true; url: string; qr: string; minutes: number } | { ok: false; message: string };
export type OwnerChatStatus = { linked: boolean; name: string | null; at: string | null };

/** Включить или выключить каналы. */
export async function saveOwnerChannels(channels: { telegram: boolean; wecom: boolean }): Promise<OwnerNotifyResult> {
  const session = await requireAdmin();
  const s = await ensureOwnerSettings();
  await prisma.ownerNotificationSettings.update({
    where: { id: s.id },
    data: { telegramEnabled: channels.telegram, wecomEnabled: channels.wecom, updatedBy: session.user.id },
  });
  revalidatePath("/settings");
  return { ok: true, message: "Сохранено" };
}

/** Сохранить ссылку бота группы WeCom: только рабочую — при сохранении в группу уходит сообщение-проверка. */
export async function saveWecomWebhook(url: string): Promise<OwnerNotifyResult> {
  const session = await requireAdmin();
  const webhook = url.trim();
  if (!WECOM_WEBHOOK_RE.test(webhook)) {
    return { ok: false, message: "Ссылка выглядит неверно: нужна вида https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=… — скопируйте её у бота группы целиком" };
  }
  const check = await sendWecom(webhook, "✅ Оповещения из админки подключены к этой группе.");
  if (!check.ok) return { ok: false, message: `Ссылка не сработала. ${check.error ?? ""}`.trim() };
  const s = await ensureOwnerSettings();
  await prisma.ownerNotificationSettings.update({
    where: { id: s.id },
    data: { wecomWebhook: webhook, wecomEnabled: true, updatedBy: session.user.id },
  });
  revalidatePath("/settings");
  return { ok: true, message: "Ссылка сохранена, в группу WeCom ушло сообщение-проверка" };
}

export async function removeWecomWebhook(): Promise<OwnerNotifyResult> {
  const session = await requireAdmin();
  await prisma.ownerNotificationSettings.updateMany({ data: { wecomWebhook: null, wecomEnabled: false, updatedBy: session.user.id } });
  revalidatePath("/settings");
  return { ok: true, message: "Ссылка WeCom удалена" };
}

/** Ссылка «Привязать мой Telegram»: бот + одноразовый код (10 минут), и QR-код для телефона. */
export async function createOwnerTelegramLink(): Promise<OwnerLink> {
  const session = await requireAdmin();
  if (!isTelegramConfigured()) return { ok: false, message: "Бот Telegram на сервере не настроен (нет токена бота)" };
  const bot = await getTelegramBotName();
  if (!bot) return { ok: false, message: "Не удалось узнать имя бота Telegram — попробуйте позже" };
  const { code } = await newOwnerLinkCode(session.user.id);
  const url = `https://t.me/${bot}?start=${OWNER_START}${code}`;
  const qr = await QRCode.toString(url, { type: "svg", margin: 1, width: 168, errorCorrectionLevel: "M" });
  return { ok: true, url, qr, minutes: LINK_CODE_MINUTES };
}

/** Привязан ли чат владельца — окно настроек спрашивает, пока показана ссылка. */
export async function ownerChatStatus(): Promise<OwnerChatStatus> {
  if (!(await auth())) return { linked: false, name: null, at: null };
  const s = await getOwnerSettings();
  return { linked: Boolean(s?.ownerChatId), name: s?.ownerChatName ?? null, at: s?.ownerLinkedAt?.toISOString() ?? null };
}

export async function unlinkOwnerTelegram(): Promise<OwnerNotifyResult> {
  const session = await requireAdmin();
  await prisma.ownerNotificationSettings.updateMany({
    data: { ownerChatId: null, ownerChatName: null, ownerLinkedAt: null, linkCodeHash: null, linkCodeExpires: null, telegramEnabled: false, updatedBy: session.user.id },
  });
  revalidatePath("/settings");
  return { ok: true, message: "Telegram отвязан" };
}

const CHANNEL_TEXT: Record<ChannelResult, string> = {
  sent: "отправлено",
  off: "выключен",
  "not-set": "не настроен",
  error: "ошибка",
};

/** Проверочное сообщение во все включённые каналы. */
export async function sendOwnerTest(): Promise<OwnerNotifyResult> {
  await requireAdmin();
  const result = await notifyOwner("🔔 Проверка: служебные оповещения из админки работают.");
  revalidatePath("/settings");
  const ok = result.telegram === "sent" || result.wecom === "sent";
  return {
    ok: ok && result.telegram !== "error" && result.wecom !== "error",
    message: `Telegram — ${CHANNEL_TEXT[result.telegram]}, WeCom — ${CHANNEL_TEXT[result.wecom]}`,
  };
}
