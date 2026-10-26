import { tabIconResponse } from "@/lib/tab-icon";

// Значок вкладки браузера в кабинете клиента и на входе в него — компании клиентов.

export const dynamic = "force-dynamic";

export function GET() {
  return tabIconResponse({ cabinetBrand: true }, { name: "Личный кабинет", color: "#6dab3c" });
}
