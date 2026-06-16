import { NextResponse } from "next/server";
import { verifyInitData } from "@/lib/telegram";
import { findCustomerByTelegramId } from "@/lib/client-link";
import { setClientSession } from "@/lib/client-session";

/**
 * Вход клиента в кабинет через Telegram Mini App.
 * Принимает initData, валидирует подпись, и если этот Telegram уже привязан
 * к клиенту — ставит клиентскую сессию.
 */
export async function POST(req: Request) {
  let initData = "";
  try {
    const body = await req.json();
    initData = typeof body?.initData === "string" ? body.initData : "";
  } catch {
    return NextResponse.json({ status: "error" }, { status: 400 });
  }

  const verified = verifyInitData(initData);
  if (!verified) {
    return NextResponse.json({ status: "invalid" }, { status: 401 });
  }

  const customer = await findCustomerByTelegramId(String(verified.user.id));
  if (!customer) {
    return NextResponse.json({ status: "need-link" });
  }

  await setClientSession(customer.id);
  return NextResponse.json({ status: "ok" });
}
