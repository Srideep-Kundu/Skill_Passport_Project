import i18n, { applyDocumentLocale, detectBrowserLocale, localeStorageKey, readLocalLocale } from "./i18n";
import { describe, expect, it } from "vitest";
import { englishTranslation, resources } from "./resources";
import { localeRegistry, supportedLocaleCodes } from "./registry";

function placeholders(value: string): string[] {
  return [...value.matchAll(/{{\s*([^},\s]+)[^}]*}}/g)].map((match) => match[1]).sort();
}

describe("localization integrity", () => {
  it("registers English and every Eighth Schedule language exactly once", () => {
    expect(localeRegistry).toHaveLength(20);
    expect(new Set(supportedLocaleCodes).size).toBe(20);
    expect(supportedLocaleCodes[0]).toBe("en");
  });

  it("provides non-empty resources with the English key and placeholder contract", () => {
    const expectedKeys = Object.keys(englishTranslation).sort();
    for (const locale of localeRegistry) {
      const translation = resources[locale.code].translation;
      expect(Object.keys(translation).sort()).toEqual(expectedKeys);
      for (const key of expectedKeys) {
        expect(translation[key].trim()).not.toBe("");
        expect(placeholders(translation[key])).toEqual(placeholders((englishTranslation as Record<string, string>)[key]));
      }
    }
  });

  it("removes Urdu, Kashmiri, and Sindhi while keeping the remaining locales LTR", () => {
    expect(supportedLocaleCodes).not.toEqual(expect.arrayContaining(["ks", "sd", "ur"]));
    expect(localeRegistry.every((locale) => locale.dir === "ltr")).toBe(true);
  });

  it("detects exact and regional browser languages with English fallback", () => {
    expect(detectBrowserLocale(["te-IN"])).toBe("te");
    expect(detectBrowserLocale(["brx-IN"])).toBe("brx");
    expect(detectBrowserLocale(["ur-IN"])).toBe("en");
    expect(detectBrowserLocale(["fr-FR"])).toBe("en");
  });

  it("ignores a saved preference for a retired locale", () => {
    localStorage.setItem(localeStorageKey, "ur");
    expect(readLocalLocale()).toBeNull();
  });

  it("updates root language and direction", () => {
    applyDocumentLocale("hi");
    expect(document.documentElement).toHaveAttribute("lang", "hi");
    expect(document.documentElement).toHaveAttribute("dir", "ltr");
    expect(document.documentElement).toHaveAttribute("data-locale", "hi");
    applyDocumentLocale("ta");
    expect(document.documentElement).toHaveAttribute("lang", "ta");
    expect(document.documentElement).toHaveAttribute("dir", "ltr");
    expect(document.documentElement).toHaveAttribute("data-locale", "ta");
  });

  it("persists a selected locale and falls back to English keys", async () => {
    localStorage.setItem(localeStorageKey, "hi");
    await i18n.changeLanguage("hi");
    expect(i18n.t("landing.headline")).toBe("जहाँ प्रमाण अवसर बनता है।");
    expect(i18n.t("match.title")).toBe(englishTranslation["match.title"]);
  });
});
