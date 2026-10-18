import type { Metadata } from "next";
import { BrandProvider } from "@/components/brand/brand-context";
import { cabinetDescription } from "@/lib/brand";
import { getCabinetBrand } from "@/lib/company";

// Страница входа — клиентская (use client), поэтому название вкладки и бренд кабинета задаются здесь
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getCabinetBrand();
  return {
    title: { absolute: `Вход в личный кабинет | ${brand.name}` },
    description: cabinetDescription(brand),
  };
}

export default async function EntranceLayout({ children }: { children: React.ReactNode }) {
  return <BrandProvider brand={await getCabinetBrand()}>{children}</BrandProvider>;
}
