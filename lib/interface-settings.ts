import { prisma } from "@/lib/prisma";
import { normalizeForms, type FormsSettings } from "@/lib/form";
import {
  normalizeFavorites,
  normalizeHistory,
  normalizePanels,
  type HistoryEntry,
  type PageRef,
  type PanelLayout,
} from "@/lib/interface";

export type UserInterface = { panels: PanelLayout; favorites: PageRef[]; history: HistoryEntry[]; forms: FormsSettings };

// Настройки интерфейса сотрудника; если ещё не сохранял — стандартные.
// Читаются на каждой странице админки: при сбое базы — стандартные, чтобы админка открылась.
export async function getUserInterface(userId: string): Promise<UserInterface> {
  const row = await prisma.userInterfaceSettings.findUnique({ where: { userId } }).catch((error) => {
    console.error("Не удалось прочитать настройки интерфейса:", error);
    return null;
  });
  return {
    panels: normalizePanels(row?.panels),
    favorites: normalizeFavorites(row?.favorites),
    history: normalizeHistory(row?.history),
    forms: normalizeForms(row?.forms),
  };
}
