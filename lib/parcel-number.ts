import { prisma } from "@/lib/prisma";

/**
 * Следующий номер посылки: всегда чистый формат PF + 6 цифр (PF000001, PF000002, …).
 *
 * Учитываются только номера формата `PF<digits>` — импортированные исторические
 * номера в формате «ИД+номер+страна» (например GZ623988DE) игнорируются, чтобы
 * нумерация не сбивалась и не наследовала чужой формат. Берём максимальное число,
 * а не последнюю по дате запись.
 */
export async function nextParcelNumber(): Promise<string> {
  const parcels = await prisma.parcel.findMany({
    where: { number: { startsWith: "PF" } },
    select: { number: true },
  });

  let max = 0;
  for (const { number } of parcels) {
    const m = /^PF(\d+)$/.exec(number ?? "");
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }

  return "PF" + String(max + 1).padStart(6, "0");
}
