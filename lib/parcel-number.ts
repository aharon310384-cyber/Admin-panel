import { prisma } from "@/lib/prisma";

/** Следующий номер посылки: PF000001, PF000002, … */
export async function nextParcelNumber(): Promise<string> {
  const last = await prisma.parcel.findFirst({
    orderBy: { createdAt: "desc" },
    select: { number: true },
  });
  const lastNum = last?.number?.match(/\d+/)?.[0];
  const n = lastNum ? parseInt(lastNum, 10) + 1 : 1;
  return "PF" + String(n).padStart(6, "0");
}
