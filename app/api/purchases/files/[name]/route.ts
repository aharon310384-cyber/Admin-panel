import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { getClientSessionCustomerId } from "@/lib/client-session";
import { purchaseFileOwner, purchaseFilesDir } from "@/lib/purchase-files";

const CONTENT_TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

// Вложение покупки: сотруднику — любое, клиенту — только своё.
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const owner = purchaseFileOwner(name);
  if (!owner) return new Response("Не найдено", { status: 404 });

  const session = await auth();
  if (!session) {
    const customerId = await getClientSessionCustomerId();
    if (customerId !== owner) return new Response("Нет доступа", { status: 403 });
  }

  try {
    const data = await readFile(path.join(purchaseFilesDir(), name));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": CONTENT_TYPES[name.split(".").pop() ?? ""] ?? "application/octet-stream",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return new Response("Не найдено", { status: 404 });
  }
}
