export type LocaleCode =
  | "en" | "as" | "bn" | "brx" | "doi" | "gu" | "hi" | "kn" | "kok" | "mai"
  | "ml" | "mni" | "mr" | "ne" | "or" | "pa" | "sa" | "sat" | "ta" | "te";

export type TextDirection = "ltr" | "rtl";

export interface TranslationResource {
  [namespace: string]: Record<string, string>;
  translation: Record<string, string>;
}
