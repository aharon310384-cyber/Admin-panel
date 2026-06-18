import type { Metadata } from "next";
import { LogOut, Mail, MapPin, Phone, Settings } from "lucide-react";
import { clientLogout, exitClientCabinet } from "@/actions/client-cabinet";
import SettingsPanel from "@/components/cabinet/settings-panel";
import { getClientCabinetContext } from "@/lib/client-cabinet";

export const metadata: Metadata = { title: "Профиль" };

function fullName(c: {
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  name: string;
}): string {
  const parts = [c.lastName, c.firstName, c.middleName]
    .map((p) => p?.trim())
    .filter(Boolean);
  return parts.length ? parts.join(" ") : c.name.trim();
}

export default async function ClientCabinetProfilePage() {
  const { client, mode } = await getClientCabinetContext();
  const isAdminView = mode === "admin";

  const name = fullName(client);
  const contacts = [
    { icon: Mail, label: "Email", value: client.email },
    { icon: Phone, label: "Телефон", value: client.phone },
    {
      icon: MapPin,
      label: "Адрес",
      value: [client.country, client.city, client.address].filter(Boolean).join(", ") || null,
    },
  ].filter((c) => c.value);

  return (
    <div className="pr">
      <header className="pr-hero">
        <h1 className="pr-name">{name}</h1>
        <span className="pr-code">{client.code}</span>
      </header>

      {contacts.length > 0 && (
        <section className="pr-card">
          <h2 className="pr-card-title">Контакты</h2>
          <ul className="pr-contacts">
            {contacts.map((c) => (
              <li key={c.label} className="pr-contact">
                <span className="pr-contact-icon"><c.icon size={16} /></span>
                <span className="pr-contact-body">
                  <span className="pr-contact-label">{c.label}</span>
                  <span className="pr-contact-value">{c.value}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="pr-settings">
        <h2 className="pr-settings-title">
          <Settings size={16} className="pr-settings-icon" />
          Настройки
        </h2>
        <SettingsPanel />
      </section>

      <form action={isAdminView ? exitClientCabinet : clientLogout}>
        <button type="submit" className="pr-exit">
          <LogOut size={17} />
          {isAdminView ? "Выйти из режима просмотра" : "Выйти"}
        </button>
      </form>

      <style>{`
        .pr { display: flex; flex-direction: column; gap: 14px; padding-bottom: 8px; }

        .pr-hero {
          display: flex; flex-direction: column; align-items: center; gap: 10px;
          padding: 22px 16px 20px; border-radius: var(--cab-radius-lg);
          background:
            radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, var(--cab-green) 16%, transparent) 0%, transparent 60%),
            var(--cab-surface);
          border: 1px solid color-mix(in srgb, var(--cab-green) 18%, var(--cab-border));
          box-shadow: var(--cab-shadow-sm);
        }
        .pr-name { margin: 0; font-family: var(--font-space-grotesk), sans-serif; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; text-align: center; }
        .pr-code {
          padding: 3px 12px; border-radius: 999px; font-family: var(--font-jetbrains-mono), monospace;
          font-size: 12px; font-weight: 500; color: var(--cab-green-deep);
          background: color-mix(in srgb, var(--cab-green) 13%, transparent);
          border: 1px solid color-mix(in srgb, var(--cab-green) 24%, transparent);
        }

        .pr-card {
          display: flex; flex-direction: column; gap: 12px; padding: 16px;
          border-radius: var(--cab-radius-md); background: var(--cab-surface);
          border: 1px solid var(--cab-border); box-shadow: var(--cab-shadow-sm);
        }
        .pr-card-title { margin: 0; font-size: 14px; font-weight: 700; }

        .pr-contacts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
        .pr-contact { display: flex; align-items: center; gap: 12px; }
        .pr-contact-icon {
          display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
          width: 34px; height: 34px; border-radius: 11px; color: var(--cab-green-deep);
          background: color-mix(in srgb, var(--cab-green) 12%, transparent);
        }
        .pr-contact-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .pr-contact-label { font-size: 11px; color: var(--cab-muted); }
        .pr-contact-value { font-size: 13.5px; font-weight: 500; word-break: break-word; }

        .pr-exit {
          width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          margin-top: 2px; padding: 13px; border-radius: var(--cab-radius-md);
          font-size: 14px; font-weight: 600; cursor: pointer;
          color: var(--cab-danger); background: var(--cab-surface);
          border: 1px solid color-mix(in srgb, var(--cab-danger) 28%, var(--cab-border));
          transition: background 0.15s, border-color 0.15s;
        }
        .pr-exit:hover { background: color-mix(in srgb, var(--cab-danger) 7%, var(--cab-surface)); border-color: color-mix(in srgb, var(--cab-danger) 45%, transparent); }

        .pr-settings { display: flex; flex-direction: column; gap: 10px; }
        .pr-settings-title { margin: 4px 0 0 4px; font-size: 16px; font-weight: 700; display: inline-flex; align-items: center; gap: 7px; }
        .pr-settings-icon { color: var(--cab-green-deep); }

      `}</style>
    </div>
  );
}
