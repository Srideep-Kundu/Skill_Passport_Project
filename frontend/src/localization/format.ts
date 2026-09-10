import type { LocaleCode } from "./types";

export const formatNumber = (value: number, locale: LocaleCode, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(locale, options).format(value);

export const formatPercent = (value: number, locale: LocaleCode, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1, ...options }).format(value);

export const formatDate = (value: string | Date, locale: LocaleCode, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { dateStyle: "medium", ...options }).format(new Date(value));

export const formatList = (values: string[], locale: LocaleCode, options?: Intl.ListFormatOptions) =>
  new Intl.ListFormat(locale, { style: "long", type: "conjunction", ...options }).format(values);
