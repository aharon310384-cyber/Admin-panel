import type { Metadata } from "next";

// Страница входа — клиентская (use client), поэтому название вкладки задаётся здесь
export const metadata: Metadata = {
  title: { absolute: "Вход в личный кабинет | PostmanFox" },
  description: "Личный кабинет клиента PostmanFox — посылки из Китая",
};

export default function EntranceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
