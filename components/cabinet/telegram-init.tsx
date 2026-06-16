"use client";

import { useEffect } from "react";

/**
 * Инициализация Telegram Mini App (WebApp SDK).
 * Если кабинет открыт внутри Telegram — разворачивает окно, включает подтверждение
 * закрытия и подгоняет цвета шапки/фона под наш светлый дизайн.
 * В обычном браузере (window.Telegram.WebApp отсутствует) ничего не делает.
 */

export default function TelegramInit() {
  useEffect(() => {
    const wa = window.Telegram?.WebApp;
    if (!wa) return;

    wa.ready();
    wa.expand();
    wa.enableClosingConfirmation?.();
    // Светлая тема кабинета
    wa.setHeaderColor?.("#f4f7f0");
    wa.setBackgroundColor?.("#f4f7f0");

    document.documentElement.dataset.telegram = "1";
  }, []);

  return null;
}
