import type { Metadata } from "next";
import { MapPin, Phone, UserPlus, Users } from "lucide-react";
import { getClientCabinetContext } from "@/lib/client-cabinet";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Получатели" };

export default async function ClientCabinetRecipientsPage() {
  const { client } = await getClientCabinetContext();
  const codeVariants = Array.from(
    new Set([client.code, client.code.toUpperCase(), client.code.toLowerCase()])
  );

  const parcels = await prisma.parcel.findMany({
    where: {
      deletedAt: null,
      routePrefix: { in: codeVariants },
      recipientName: { not: null },
    },
    select: { recipientName: true, recipientAddress: true, recipientPhone: true },
    orderBy: { createdAt: "desc" },
    take: 120,
  });

  const seen = new Set<string>();
  const recipients: { name: string; address: string | null; phone: string | null }[] = [];
  for (const p of parcels) {
    const name = p.recipientName?.trim();
    if (!name) continue;
    const key = `${name}|${p.recipientAddress ?? ""}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push({ name, address: p.recipientAddress, phone: p.recipientPhone });
  }

  return (
    <div className="rc">
      <header className="rc-head">
        <h1 className="rc-title">Получатели</h1>
        <span className="rc-count">{recipients.length}</span>
        <button type="button" className="rc-add rc-add--off" aria-disabled="true" title="Скоро">
          <UserPlus size={16} />
          Добавить получателя
        </button>
      </header>
      <p className="rc-sub">Адреса из ваших посылок</p>

      {recipients.length === 0 ? (
        <div className="rc-empty">
          <Users size={30} className="rc-empty-icon" />
          <p className="rc-empty-title">Получателей пока нет</p>
          <p className="rc-empty-sub">Они появятся после первой посылки</p>
        </div>
      ) : (
        <ul className="rc-list">
          {recipients.map((r, i) => (
            <li key={i} className="rc-card">
              <span className="rc-avatar">{r.name.charAt(0).toUpperCase()}</span>
              <div className="rc-body">
                <span className="rc-name">{r.name}</span>
                {r.address && (
                  <span className="rc-line"><MapPin size={12} /> {r.address}</span>
                )}
                {r.phone && (
                  <span className="rc-line rc-line--mono"><Phone size={12} /> {r.phone}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <style>{`
        .rc { display: flex; flex-direction: column; gap: 6px; padding-bottom: 8px; }
        .rc-head { display: flex; align-items: center; gap: 10px; padding: 8px 4px 0; }
        .rc-title { margin: 0; font-family: var(--font-space-grotesk), sans-serif; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }
        .rc-count {
          display: inline-flex; align-items: center; justify-content: center; min-width: 26px; height: 24px;
          padding: 0 8px; border-radius: 999px; font-size: 12.5px; font-weight: 700; font-variant-numeric: tabular-nums;
          color: var(--cab-green-deep); background: color-mix(in srgb, var(--cab-green) 14%, transparent);
        }
        .rc-sub { margin: 0 0 10px 4px; font-size: 13px; color: var(--cab-muted); }

        .rc-add {
          margin-left: auto; display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 14px; border-radius: var(--cab-radius-sm); border: none;
          font-size: 13px; font-weight: 600; color: #fff; cursor: pointer;
          background: linear-gradient(150deg, var(--cab-green), var(--cab-green-deep));
          box-shadow: 0 6px 14px color-mix(in srgb, var(--cab-green) 32%, transparent);
        }
        .rc-add--off { opacity: 0.45; pointer-events: none; box-shadow: none; cursor: default; }

        .rc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
        .rc-card {
          display: flex; align-items: flex-start; gap: 12px; padding: 14px;
          border-radius: var(--cab-radius-md); background: var(--cab-surface);
          border: 1px solid var(--cab-border); box-shadow: var(--cab-shadow-sm);
        }
        .rc-avatar {
          display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
          width: 40px; height: 40px; border-radius: 13px; color: #fff;
          font-family: var(--font-space-grotesk), sans-serif; font-size: 16px; font-weight: 700;
          background: linear-gradient(150deg, var(--cab-green), var(--cab-green-deep));
        }
        .rc-body { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
        .rc-name { font-size: 14px; font-weight: 600; }
        .rc-line { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--cab-text-soft); line-height: 1.4; }
        .rc-line svg { flex-shrink: 0; color: var(--cab-muted); }
        .rc-line--mono { font-family: var(--font-jetbrains-mono), monospace; font-size: 11.5px; color: var(--cab-muted); }

        .rc-empty {
          display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px;
          margin-top: 4px; padding: 40px 16px; border-radius: var(--cab-radius-md);
          background: var(--cab-surface); border: 1px solid var(--cab-border);
        }
        .rc-empty-icon { color: var(--cab-muted); opacity: 0.55; }
        .rc-empty-title { margin: 4px 0 0; font-weight: 700; font-size: 15px; }
        .rc-empty-sub { margin: 0; font-size: 12.5px; color: var(--cab-muted); }

      `}</style>
    </div>
  );
}
