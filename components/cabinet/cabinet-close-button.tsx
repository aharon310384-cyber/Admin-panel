"use client";

import { LogOut } from "lucide-react";
import { clientLogout, exitClientCabinet } from "@/actions/client-cabinet";

type TelegramWebApp = { close?: () => void };

/**
 * «Выйти» в кабинете = «Закрыть» Mini App.
 * В Telegram Mini App просто закрывает окно (Telegram.WebApp.close()).
 * Вне Telegram (браузер / админ-просмотр) — обычный выход/возврат в админку.
 */
export default function CabinetCloseButton({ isAdminView }: { isAdminView: boolean }) {
  const onClick = async () => {
    const tg =
      typeof window !== "undefined"
        ? (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp
        : undefined;

    // В админ-режиме «просмотра» нужен возврат в админку, а не закрытие окна
    if (!isAdminView && tg?.close) {
      tg.close();
      return;
    }
    if (isAdminView) {
      await exitClientCabinet();
    } else {
      await clientLogout();
    }
  };

  return (
    <button type="button" className="pr-exit" onClick={onClick}>
      <LogOut size={17} />
      {isAdminView ? "Выйти из режима просмотра" : "Выйти"}
    </button>
  );
}
