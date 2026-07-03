"use client";

import { createContext, useContext, useState } from "react";
import {
  adminTranslations,
  adminLocaleOrder,
  type AdminLocaleCode,
  type AdminTranslation,
} from "./admin";

interface AdminLanguageContextValue {
  locale: AdminLocaleCode;
  setLocale: (locale: AdminLocaleCode) => void;
  t: AdminTranslation;
}

const AdminLanguageContext = createContext<AdminLanguageContextValue | null>(null);

const STORAGE_KEY = "bb-admin-locale";

function detectBrowserLocale(): AdminLocaleCode {
  if (typeof navigator === "undefined") return "en";
  const nav = navigator.language?.slice(0, 2).toLowerCase();
  return (adminLocaleOrder as string[]).includes(nav) ? (nav as AdminLocaleCode) : "en";
}

export function AdminLanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AdminLocaleCode>(() => {
    if (typeof window === "undefined") return "en";
    const stored = window.localStorage.getItem(STORAGE_KEY) as AdminLocaleCode | null;
    return stored && adminTranslations[stored] ? stored : detectBrowserLocale();
  });

  function setLocale(next: AdminLocaleCode) {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <AdminLanguageContext.Provider value={{ locale, setLocale, t: adminTranslations[locale] }}>
      {children}
    </AdminLanguageContext.Provider>
  );
}

export function useAdminLanguage() {
  const ctx = useContext(AdminLanguageContext);
  if (!ctx) throw new Error("useAdminLanguage must be used within AdminLanguageProvider");
  return ctx;
}
