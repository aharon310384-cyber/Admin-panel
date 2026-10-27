import { tabIconResponse } from "@/lib/tab-icon";

// Значок вкладки браузера в кабинете клиента и на входе в него — компании клиентов.

export const dynamic = "force-dynamic";

export function GET() {
  return tabIconResponse({ cabinetBrand: true }, { name: "Личный кабинет", gradient: ["#87ba5f", "#6dab3c", "#4e8a2a"] });
}
