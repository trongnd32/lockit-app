export const db = {
  strings: new Map(),   // KEY -> { id, category, notes, langs: {en: "...", vi: "..."} }
  categories: new Set(['general']),
  languages: new Set(),
};
