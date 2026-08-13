import type { TranslationCatalog } from './catalogs.ts';
import { en } from './catalogs.ts';
import { translationCatalogs, type SupportedLanguage } from './localization.ts';

export type CatalogValidationIssue = {
  language: SupportedLanguage;
  key: string;
  reason: 'missing' | 'unknown' | 'placeholder' | 'raw_key';
};

export function validateTranslationCatalogs() {
  const expected = flatten(en);
  const issues: CatalogValidationIssue[] = [];

  for (const [language, catalog] of Object.entries(translationCatalogs) as [
    SupportedLanguage,
    TranslationCatalog,
  ][]) {
    const actual = flatten(catalog);
    for (const [key, value] of expected) {
      const translated = actual.get(key);
      if (translated === undefined) {
        issues.push({ language, key, reason: 'missing' });
      } else if (!samePlaceholders(value, translated)) {
        issues.push({ language, key, reason: 'placeholder' });
      } else if (translated === key) {
        issues.push({ language, key, reason: 'raw_key' });
      }
    }
    for (const key of actual.keys()) {
      if (!expected.has(key)) issues.push({ language, key, reason: 'unknown' });
    }
  }

  return issues;
}

function flatten(catalog: TranslationCatalog) {
  const entries: [string, string][] = [];
  for (const [section, values] of Object.entries(catalog)) {
    for (const [key, value] of Object.entries(values)) {
      entries.push([`${section}.${key}`, value]);
    }
  }
  return new Map(entries);
}

function samePlaceholders(expected: string, actual: string) {
  return JSON.stringify(placeholders(expected)) === JSON.stringify(placeholders(actual));
}

function placeholders(value: string) {
  return [...value.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)]
    .map((match) => match[1])
    .sort();
}
