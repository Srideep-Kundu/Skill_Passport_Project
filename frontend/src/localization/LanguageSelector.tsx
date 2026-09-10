import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { localeStorageKey, pendingLocaleStorageKey } from "./i18n";
import { isLocaleCode, localeByCode, localeRegistry } from "./registry";
import type { LocaleCode } from "./types";

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const value: LocaleCode = isLocaleCode(i18n.resolvedLanguage ?? "")
    ? i18n.resolvedLanguage as LocaleCode
    : "en";

  const changeLanguage = (next: string) => {
    if (!isLocaleCode(next)) return;
    localStorage.setItem(localeStorageKey, next);
    void i18n.changeLanguage(next);
    if (session) {
      sessionStorage.removeItem(pendingLocaleStorageKey);
      void api.updatePreferences({ preferred_locale: next }, session.access_token).catch(() => undefined);
    } else {
      sessionStorage.setItem(pendingLocaleStorageKey, next);
    }
  };

  return (
    <label data-no-auto-translate className="language-selector inline-flex min-w-0 items-center gap-2 text-xs text-slate-700">
      <Languages className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="sr-only">{t("language.selectorLabel")}</span>
      <select
        aria-label={t("language.selectorLabel")}
        dir={localeByCode[value].dir}
        value={value}
        onChange={(event) => changeLanguage(event.target.value)}
        className={`min-w-0 rounded-lg border border-slate-300 bg-white/85 px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#B08D57] ${compact ? "max-w-28" : "max-w-48"}`}
      >
        {localeRegistry.filter((locale) => locale.enabled).map((locale) => (
          <option key={locale.code} value={locale.code} dir={locale.dir}>
            {locale.nativeName}{compact ? "" : ` — ${locale.englishName}`}
          </option>
        ))}
      </select>
    </label>
  );
}
