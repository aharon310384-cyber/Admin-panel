// Единый тип Telegram Mini App (WebApp SDK), используемый клиентскими компонентами.
interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close?: () => void;
  enableClosingConfirmation?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  initData?: string;
  colorScheme?: string;
}

interface Window {
  Telegram?: { WebApp?: TelegramWebApp };
}
