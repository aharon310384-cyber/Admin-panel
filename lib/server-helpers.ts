import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function requireAuth() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Нет доступа");
  }
  return session;
}
