import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AdminShell from "@/components/layout/admin-shell";
import { BrandProvider } from "@/components/brand/brand-context";
import { getAdminBrand } from "@/lib/company";
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

  const [{ panels, favorites, history, forms }, brand] = await Promise.all([
    getUserInterface(session.user.id),
    getAdminBrand(),
  ]);

  return (
    <BrandProvider brand={brand}>
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
    </BrandProvider>
  );
}
