"use client";

// Настройка форм сотрудника и закрытие окна — для рамки окна (Form). Даёт AdminShell.
import { createContext, useContext } from "react";
import type { FormSettingsPatch } from "@/actions/interface";
import type { FormsSettings } from "@/lib/form";

export type FormsApi = {
  forms: FormsSettings;
  saveForm: (formKey: string, patch: FormSettingsPatch) => Promise<boolean>;
  closeCurrent: (() => void) | null; // null — окно не закрывается (начальная страница)
};

export const FormsContext = createContext<FormsApi | null>(null);

export const useForms = () => useContext(FormsContext);
