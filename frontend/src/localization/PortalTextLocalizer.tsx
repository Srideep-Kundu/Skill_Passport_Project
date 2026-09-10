import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { LocaleCode } from "./types";

type Catalog = Record<string, string>;

const catalogModules = import.meta.glob<{ default: Catalog }>([
  "./generated/*.json",
  "!./generated/source-phrases.json",
  "!./generated/*.partial.json",
]);
const catalogLoaders = Object.fromEntries(
  Object.entries(catalogModules)
    .filter(([path]) => !path.endsWith("source-phrases.json"))
    .map(([path, loader]) => [path.match(/\/([^/]+)\.json$/)?.[1], loader]),
) as Partial<Record<LocaleCode, () => Promise<{ default: Catalog }>>>;
const textOriginals = new WeakMap<Text, string>();
const textApplied = new WeakMap<Text, string>();
const attributeOriginals = new WeakMap<Element, Map<string, string>>();
const attributeApplied = new WeakMap<Element, Map<string, string>>();
const attributes = ["aria-label", "placeholder", "title", "alt"] as const;
const excludedElements = "script,style,code,pre,kbd,samp,[data-no-auto-translate]";

function preserveSpacing(original: string, translated: string): string {
  const leading = original.match(/^\s*/)?.[0] ?? "";
  const trailing = original.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

function localizeText(node: Text, catalog: Catalog | undefined, useEnglish: boolean): void {
  if (node.parentElement?.closest(excludedElements)) return;
  const current = node.data;
  const lastApplied = textApplied.get(node);
  if (!textOriginals.has(node) || (lastApplied !== undefined && current !== lastApplied)) {
    textOriginals.set(node, current);
  }
  const original = textOriginals.get(node) ?? current;
  const phrase = original.replace(/\s+/g, " ").trim();
  const translated = useEnglish || !phrase ? phrase : catalog?.[phrase] ?? phrase;
  const next = preserveSpacing(original, translated);
  textApplied.set(node, next);
  if (current !== next) node.data = next;
}

function localizeAttributes(element: Element, catalog: Catalog | undefined, useEnglish: boolean): void {
  if (element.closest(excludedElements)) return;
  const originals = attributeOriginals.get(element) ?? new Map<string, string>();
  const applied = attributeApplied.get(element) ?? new Map<string, string>();
  for (const attribute of attributes) {
    const current = element.getAttribute(attribute);
    if (!current) continue;
    if (!originals.has(attribute) || (applied.has(attribute) && current !== applied.get(attribute))) {
      originals.set(attribute, current);
    }
    const original = originals.get(attribute) ?? current;
    const next = useEnglish ? original : catalog?.[original] ?? original;
    applied.set(attribute, next);
    if (current !== next) element.setAttribute(attribute, next);
  }
  attributeOriginals.set(element, originals);
  attributeApplied.set(element, applied);
}

function localizeTree(root: Node, catalog: Catalog | undefined, useEnglish: boolean): void {
  if (root.nodeType === Node.TEXT_NODE) localizeText(root as Text, catalog, useEnglish);
  if (root.nodeType === Node.ELEMENT_NODE) localizeAttributes(root as Element, catalog, useEnglish);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) localizeText(node as Text, catalog, useEnglish);
    else localizeAttributes(node as Element, catalog, useEnglish);
    node = walker.nextNode();
  }
}

export function PortalTextLocalizer(): null {
  const { i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? "en") as LocaleCode;

  useEffect(() => {
    let active = true;
    let observer: MutationObserver | undefined;
    const start = async () => {
      const loader = catalogLoaders[locale];
      const catalog = loader ? (await loader()).default : undefined;
      if (!active) return;
      const useEnglish = locale === "en";
      localizeTree(document.body, catalog, useEnglish);
      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "characterData") localizeText(mutation.target as Text, catalog, useEnglish);
          else if (mutation.type === "attributes") localizeAttributes(mutation.target as Element, catalog, useEnglish);
          else for (const node of mutation.addedNodes) localizeTree(node, catalog, useEnglish);
        }
      });
      observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...attributes] });
    };
    void start();
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [locale]);

  return null;
}
