import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AdminShell from "@/components/layout/admin-shell";
import { getUserInterface } from "@/lib/interface-settings";
import "./density.css";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const { panels, favorites, history, forms } = await getUserInterface(session.user.id);

  return (
    <AdminShell
      userName={session.user.name ?? "Пользователь"}
      userRole={session.user.role}
      panels={panels}
      favorites={favorites}
      history={history}
      forms={forms}
    >
      {children}
    </AdminShell>
  );
}
