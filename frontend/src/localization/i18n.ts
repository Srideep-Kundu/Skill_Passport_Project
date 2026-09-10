import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { localeByCode, supportedLocaleCodes, isLocaleCode } from "./registry";
import { resources } from "./resources";
import type { LocaleCode } from "./types";

export const localeStorageKey = "skill-passport.locale";
export const pendingLocaleStorageKey = "skill-passport.pending-locale";

export function detectBrowserLocale(languages: readonly string[] = navigator.languages): LocaleCode {
  for (const language of languages) {
    const normalized = language.toLowerCase().replace("_", "-");
    if (isLocaleCode(normalized)) return normalized;
    const base = normalized.split("-", 1)[0];
    if (isLocaleCode(base)) return base;
  }
  return "en";
}

export function readLocalLocale(): LocaleCode | null {
  try {
    const value = localStorage.getItem(localeStorageKey);
    return value && isLocaleCode(value) ? value : null;
  } catch {
    return null;
  }
}

export function readPendingLocale(): LocaleCode | null {
  try {
    const value = sessionStorage.getItem(pendingLocaleStorageKey);
    return value && isLocaleCode(value) ? value : null;
  } catch {
    return null;
  }
}

export function applyDocumentLocale(code: LocaleCode): void {
  const locale = localeByCode[code];
  document.documentElement.lang = code;
  document.documentElement.dir = locale.dir;
  document.documentElement.dataset.locale = code;
}

const initialLocale = readLocalLocale() ?? detectBrowserLocale();

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLocale,
  fallbackLng: "en",
  supportedLngs: supportedLocaleCodes,
  nonExplicitSupportedLngs: true,
  interpolation: { escapeValue: false },
  returnNull: false,
  initImmediate: false,
  showSupportNotice: false,
});

applyDocumentLocale(initialLocale);
i18n.on("languageChanged", (language: string) => {
  const code = isLocaleCode(language) ? language : "en";
  applyDocumentLocale(code);
});

export default i18n;
