"use client";

// Пункты «Интерфейс» на странице «Настройки» — как в 1С.
import { useState } from "react";
import PanelsEditor from "@/components/settings/panels-editor";
import type { PanelLayout } from "@/lib/interface";

export default function InterfaceMenu({ panels }: { panels: PanelLayout }) {
  const [panelsOpen, setPanelsOpen] = useState(false);

  return (
    <>
      <ul className="ui-menu">
        <li>
          <button type="button" className="ui-menu-item ui-menu-item--action" onClick={() => setPanelsOpen(true)}>
            Настройка панелей…
          </button>
        </li>
        {/* Что будет в этих окнах — обсуждаем, пока только пункты. */}
        {["Настройка начальной страницы…", "Настройка панели разделов…"].map((label) => (
          <li key={label} className="ui-menu-item">
            <span>{label}</span>
            <span className="ui-menu-soon">скоро</span>
          </li>
        ))}
      </ul>
      <PanelsEditor open={panelsOpen} onOpenChange={setPanelsOpen} saved={panels} />
    </>
  );
}
