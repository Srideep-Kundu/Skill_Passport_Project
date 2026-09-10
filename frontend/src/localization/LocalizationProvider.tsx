import { useEffect, useRef } from "react";
import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import {
  applyDocumentLocale,
  localeStorageKey,
  pendingLocaleStorageKey,
  readPendingLocale,
} from "./i18n";
import { isLocaleCode } from "./registry";
import { PortalTextLocalizer } from "./PortalTextLocalizer";

export function LocalizationProvider({ children }: PropsWithChildren) {
  const { i18n } = useTranslation();
  const { session } = useAuth();
  const syncedToken = useRef<string | null>(null);

  useEffect(() => {
    const resolved = i18n.resolvedLanguage ?? "";
    const code = isLocaleCode(resolved) ? resolved : "en";
    applyDocumentLocale(code);
  }, [i18n, i18n.resolvedLanguage]);

  useEffect(() => {
    if (!session || syncedToken.current === session.access_token) return;
    syncedToken.current = session.access_token;
    let active = true;
    const pendingLocale = readPendingLocale();

    if (pendingLocale) {
      localStorage.setItem(localeStorageKey, pendingLocale);
      void i18n.changeLanguage(pendingLocale);
      void api.updatePreferences({ preferred_locale: pendingLocale }, session.access_token).then(() => {
        if (active && sessionStorage.getItem(pendingLocaleStorageKey) === pendingLocale) {
          sessionStorage.removeItem(pendingLocaleStorageKey);
        }
      }).catch(() => {
        // Keep the pending choice so a later authenticated reload can retry persistence.
      });
    } else {
      void api.getPreferences(session.access_token).then((preferences) => {
        if (!active || !preferences.preferred_locale || !isLocaleCode(preferences.preferred_locale)) return;
        localStorage.setItem(localeStorageKey, preferences.preferred_locale);
        void i18n.changeLanguage(preferences.preferred_locale);
      }).catch(() => {
        // Local and browser preference remain valid fallbacks when the account request fails.
      });
    }
    return () => { active = false; };
  }, [i18n, session]);

  return <><PortalTextLocalizer />{children}</>;
}
