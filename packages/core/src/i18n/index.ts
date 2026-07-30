import type { LocaleStrings } from "../types/types";
import en from "./en";
import pt from "./pt";
import ptBR from "./ptBR";
import es from "./es";
import fr from "./fr";
import ar from "./ar";

/** Every key defined by the English source-of-truth catalog. */
export type MessageKey = keyof typeof en;

/**
 * A complete message dictionary. Structurally a `LocaleStrings` (all values
 * are strings), but with every catalog key required so translations cannot
 * silently omit entries.
 */
export type CalendarMessages = Record<MessageKey, string> & LocaleStrings;

/**
 * Built-in catalogs, keyed by lower-cased, separator-free language tags
 * ("pt-BR" / "pt_BR" / "ptBR" all normalize to "ptbr").
 */
const catalogs: Record<string, CalendarMessages> = {
  en,
  pt,
  ptpt: pt,
  ptbr: ptBR,
  es,
  fr,
  ar,
};

/**
 * Resolves the built-in message catalog for a language tag.
 * Lookup order: exact tag (case/separator-insensitive) → base language →
 * English. Examples: "pt" → pt, "pt-PT" → pt, "pt-BR"/"ptBR" → ptBR,
 * "de-AT" → base "de" (no catalog) → en.
 */
export const getMessages = (lang?: string): CalendarMessages => {
  if (!lang) return en;
  const compact = lang.toLowerCase().replace(/[-_]/g, "");
  if (catalogs[compact]) return catalogs[compact];
  const base = lang.toLowerCase().split(/[-_]/)[0];
  return catalogs[base] ?? en;
};

/** Languages written right-to-left (base language codes). */
const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);

/** Extracts the base language from tags like "pt-BR", "pt_BR" or "arSA". */
const baseLanguage = (lang: string): string => {
  const camel = lang.match(/^[a-z]{2,3}(?=[A-Z]|$)/);
  if (camel) return camel[0];
  return lang.toLowerCase().split(/[-_]/)[0];
};

/**
 * Text direction for a language tag: ar/he/fa/ur (any region) → "rtl",
 * everything else → "ltr".
 */
export const getTextDirection = (lang?: string): "ltr" | "rtl" =>
  lang && RTL_LANGUAGES.has(baseLanguage(lang)) ? "rtl" : "ltr";

/**
 * Fills `{placeholder}` tokens in a message template. Unknown placeholders
 * are left intact. Falls back to `fallback` when the template is missing
 * (e.g. a bare config object that never went through the catalog).
 */
export const formatMessage = (
  template: string | undefined,
  vars: Record<string, string | number>,
  fallback: string
): string =>
  (template ?? fallback).replace(/\{(\w+)\}/g, (token, key) =>
    vars[key] !== undefined ? String(vars[key]) : token
  );

export { en, pt, ptBR, es, fr, ar };
