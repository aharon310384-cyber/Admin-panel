import { NextResponse } from "next/server";
import { verifyClientPassword } from "@/lib/client-auth";
import { setClientSession } from "@/lib/client-session";

/** Вход клиента в кабинет по коду клиента и паролю. */
export async function POST(req: Request) {
  let code = "";
  let password = "";
  try {
    const body = await req.json();
    code = typeof body?.code === "string" ? body.code : "";
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ status: "error" }, { status: 400 });
  }

  const customer = await verifyClientPassword(code, password);
  if (!customer) {
    return NextResponse.json({ status: "invalid" }, { status: 401 });
  }

  await setClientSession(customer.id);
  return NextResponse.json({ status: "ok" });
}
