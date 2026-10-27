import { tabIconResponse } from "@/lib/tab-icon";

// Значок вкладки браузера в админке и на её входе — компании-склада, чтобы админку не путать с кабинетом клиента.

export const dynamic = "force-dynamic";

export function GET() {
  return tabIconResponse({ adminBrand: true }, { name: "Админ-панель", gradient: ["#d9772f", "#bb5a2c", "#9c4424"] });
}
