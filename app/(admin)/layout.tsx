import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AdminShell from "@/components/layout/admin-shell";
import { BrandProvider } from "@/components/brand/brand-context";
import { adminThemeCss } from "@/lib/brand";
import { adminTabIcon, getAdminBrand } from "@/lib/company";
import { getUserInterface } from "@/lib/interface-settings";
import "./density.css";

export async function generateMetadata(): Promise<Metadata> {
  const icon = await adminTabIcon();
  return { icons: { icon, apple: icon } };
}

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

  const theme = adminThemeCss(brand);

  return (
    <BrandProvider brand={brand}>
      {theme && <style>{theme}</style>}
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
