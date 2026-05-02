const usdFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const cnyFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("ru-RU");

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatUsd = (value: number) => usdFormatter.format(value);
export const formatCny = (value: number) => cnyFormatter.format(value);
export const formatCurrency = formatUsd;
export const formatNumber = (n: number) => numberFormatter.format(n);
export const formatDate = (d: Date) => dateFormatter.format(d);
export const formatDateTime = (d: Date) => dateTimeFormatter.format(d);

export const orderStatusLabel: Record<string, string> = {
  new: "Новый",
  paid: "Оплачен",
  shipped: "Отправлен",
  completed: "Завершен",
  cancelled: "Отменен",
};

export const orderStatusTone: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  paid: "bg-emerald-100 text-emerald-800",
  shipped: "bg-violet-100 text-violet-800",
  completed: "bg-slate-200 text-slate-800",
  cancelled: "bg-rose-100 text-rose-800",
};
