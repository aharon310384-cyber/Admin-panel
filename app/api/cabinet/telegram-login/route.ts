import { NextResponse } from "next/server";
import { verifyLoginWidget } from "@/lib/telegram";
import { findCustomerByTelegramId } from "@/lib/client-link";
import { setClientSession } from "@/lib/client-session";

/**
 * Обработка ответа Telegram Login Widget (вход клиента из браузера).
 * Telegram редиректит сюда с подписанными параметрами пользователя.
 * Проверяем подпись, находим привязанного клиента, ставим сессию.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  // За туннелем/прокси req.url видит localhost — для редиректов берём публичный origin
  const base = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const to = (path: string) => NextResponse.redirect(new URL(path, base));

  const data: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    data[k] = v;
  });

  const user = verifyLoginWidget(data);
  if (!user) {
    return to("/entrance?e=bad");
  }

  const customer = await findCustomerByTelegramId(String(user.id));
  if (!customer) {
    return to("/entrance?e=notlinked");
  }

  await setClientSession(customer.id);
  return to("/cabinet");
}
