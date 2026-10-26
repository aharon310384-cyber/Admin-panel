import type { Metadata } from "next";
import { BrandProvider } from "@/components/brand/brand-context";
import { cabinetDescription, cabinetThemeStyle } from "@/lib/brand";
import { cabinetTabIcon, getCabinetBrand } from "@/lib/company";

// Страница входа — клиентская (use client), поэтому название вкладки и бренд кабинета задаются здесь
export async function generateMetadata(): Promise<Metadata> {
  const [brand, icon] = await Promise.all([getCabinetBrand(), cabinetTabIcon()]);
  return {
    title: { absolute: `Вход в личный кабинет | ${brand.name}` },
    description: cabinetDescription(brand),
    icons: { icon, apple: icon },
  };
}

export default async function EntranceLayout({ children }: { children: React.ReactNode }) {
  const brand = await getCabinetBrand();
  // Цвета компании клиентов — те же, что в кабинете.
  return (
    <BrandProvider brand={brand}>
      <div style={{ display: "contents", ...cabinetThemeStyle(brand) }}>{children}</div>
    </BrandProvider>
  );
}
