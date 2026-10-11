import { NextResponse } from "next/server";
import { verifyClientPassword } from "@/lib/client-auth";
import { setClientSession } from "@/lib/client-session";
import {
  lockRemainingMs,
  minutesText,
  registerFailure,
  registerSuccess,
} from "@/lib/login-guard";

function lockedResponse(ms: number) {
  return NextResponse.json(
    { status: "locked", retryIn: minutesText(ms) },
    { status: 429, headers: { "Retry-After": String(Math.ceil(ms / 1000)) } }
  );
}

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

  const locked = lockRemainingMs("client", code);
  if (locked > 0) return lockedResponse(locked);

  const customer = await verifyClientPassword(code, password);
  if (!customer) {
    if (registerFailure("client", code)) return lockedResponse(lockRemainingMs("client", code));
    return NextResponse.json({ status: "invalid" }, { status: 401 });
  }

  registerSuccess("client", code);
  await setClientSession(customer.id);
  return NextResponse.json({ status: "ok" });
}
