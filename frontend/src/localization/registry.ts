import { resources } from "./resources";
import type { LocaleCode, TextDirection, TranslationResource } from "./types";

export interface LocaleDefinition {
  code: LocaleCode;
  englishName: string;
  nativeName: string;
  script: string;
  dir: TextDirection;
  resource: TranslationResource;
  enabled: boolean;
}

const definitions: Array<Omit<LocaleDefinition, "resource" | "enabled">> = [
  { code: "en", englishName: "English", nativeName: "English", script: "Latin", dir: "ltr" },
  { code: "as", englishName: "Assamese", nativeName: "অসমীয়া", script: "Bengali-Assamese", dir: "ltr" },
  { code: "bn", englishName: "Bengali", nativeName: "বাংলা", script: "Bengali", dir: "ltr" },
  { code: "brx", englishName: "Bodo", nativeName: "बड़ो", script: "Devanagari", dir: "ltr" },
  { code: "doi", englishName: "Dogri", nativeName: "डोगरी", script: "Devanagari", dir: "ltr" },
  { code: "gu", englishName: "Gujarati", nativeName: "ગુજરાતી", script: "Gujarati", dir: "ltr" },
  { code: "hi", englishName: "Hindi", nativeName: "हिन्दी", script: "Devanagari", dir: "ltr" },
  { code: "kn", englishName: "Kannada", nativeName: "ಕನ್ನಡ", script: "Kannada", dir: "ltr" },
  { code: "kok", englishName: "Konkani", nativeName: "कोंकणी", script: "Devanagari", dir: "ltr" },
  { code: "mai", englishName: "Maithili", nativeName: "मैथिली", script: "Devanagari", dir: "ltr" },
  { code: "ml", englishName: "Malayalam", nativeName: "മലയാളം", script: "Malayalam", dir: "ltr" },
  { code: "mni", englishName: "Manipuri (Meitei)", nativeName: "ꯃꯤꯇꯩ ꯂꯣꯟ", script: "Meitei Mayek", dir: "ltr" },
  { code: "mr", englishName: "Marathi", nativeName: "मराठी", script: "Devanagari", dir: "ltr" },
  { code: "ne", englishName: "Nepali", nativeName: "नेपाली", script: "Devanagari", dir: "ltr" },
  { code: "or", englishName: "Odia", nativeName: "ଓଡ଼ିଆ", script: "Odia", dir: "ltr" },
  { code: "pa", englishName: "Punjabi", nativeName: "ਪੰਜਾਬੀ", script: "Gurmukhi", dir: "ltr" },
  { code: "sa", englishName: "Sanskrit", nativeName: "संस्कृतम्", script: "Devanagari", dir: "ltr" },
  { code: "sat", englishName: "Santali", nativeName: "ᱥᱟᱱᱛᱟᱲᱤ", script: "Ol Chiki", dir: "ltr" },
  { code: "ta", englishName: "Tamil", nativeName: "தமிழ்", script: "Tamil", dir: "ltr" },
  { code: "te", englishName: "Telugu", nativeName: "తెలుగు", script: "Telugu", dir: "ltr" },
];

export const localeRegistry: readonly LocaleDefinition[] = definitions.map((locale) => ({
  ...locale,
  resource: resources[locale.code],
  enabled: true,
}));

export const localeByCode = Object.fromEntries(localeRegistry.map((locale) => [locale.code, locale])) as Record<LocaleCode, LocaleDefinition>;
export const supportedLocaleCodes = localeRegistry.map((locale) => locale.code);

export function isLocaleCode(value: string): value is LocaleCode {
  return supportedLocaleCodes.includes(value as LocaleCode);
}
