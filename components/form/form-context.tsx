"use client";

// Настройка форм сотрудника и закрытие окна — для рамки окна (Form). Даёт AdminShell.
import { createContext, useContext } from "react";
import type { FormPart, FormsSettings } from "@/lib/form";

export type FormsApi = {
  forms: FormsSettings;
  saveForm: (formKey: string, hidden: FormPart[]) => Promise<boolean>;
  closeCurrent: () => void;
};

export const FormsContext = createContext<FormsApi | null>(null);

export const useForms = () => useContext(FormsContext);
