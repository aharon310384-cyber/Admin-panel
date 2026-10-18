"use client";

// Бренд для компонентов в браузере: макет (админки, кабинета, входа) кладёт его сюда из настроек компании.
import { createContext, useContext } from "react";
import type { Brand } from "@/lib/brand";

const BrandContext = createContext<Brand | null>(null);

export function BrandProvider({ brand, children }: { brand: Brand; children: React.ReactNode }) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

export function useBrand(): Brand {
  const brand = useContext(BrandContext);
  if (!brand) throw new Error("useBrand: нет BrandProvider в макете страницы");
  return brand;
}
