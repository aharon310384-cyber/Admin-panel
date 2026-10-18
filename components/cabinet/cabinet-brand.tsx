"use client";

import Image from "next/image";
import { useBrand } from "@/components/brand/brand-context";
import { siteLabel } from "@/lib/brand";

// Логотип в кабинете (шапка, боковая панель): картинка компании, а без неё — название. Ведёт на сайт, если он задан.
export default function CabinetBrand({ className, imgClassName }: { className: string; imgClassName: string }) {
  const brand = useBrand();
  const logo = brand.logoUrl ? (
    <Image src={brand.logoUrl} alt={brand.name} width={150} height={49} priority unoptimized className={imgClassName} />
  ) : (
    <span className="cab-brand-name">{brand.name}</span>
  );

  return (
    <>
      {brand.siteUrl ? (
        <a
          href={brand.siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
          aria-label={`Перейти на ${siteLabel(brand.siteUrl)}`}
        >
          {logo}
        </a>
      ) : (
        <span className={className}>{logo}</span>
      )}
      <style>{`
        .cab-brand-name { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; line-height: 34px; color: var(--cab-text); white-space: nowrap; }
      `}</style>
    </>
  );
}
