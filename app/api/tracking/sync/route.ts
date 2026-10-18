import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { syncTracking } from "@/lib/tracking";

// Проверка отслеживания посылок по расписанию: cron на сервере (scripts/deploy/tracking-cron.sh)
// зовёт этот адрес с ключом TRACKING_CRON_KEY из .env. Пока ключа в .env нет, адрес закрыт.

export const dynamic = "force-dynamic";

function sameKey(got: string, key: string): boolean {
  const a = Buffer.from(got);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const key = process.env.TRACKING_CRON_KEY;
  if (!key || !sameKey(req.headers.get("x-cron-key") ?? "", key)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json(await syncTracking());
}
