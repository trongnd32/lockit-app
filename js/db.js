// ── Data store ──────────────────────────────────────────────────────────────
// Central in-memory database. All string data lives here.
// The Map preserves insertion order, which is intentional — we never
// re-sort on export unless the user explicitly requests it.

const db = {
  strings:    new Map(),            // id -> { id, category, notes, langs }
  categories: new Set(['general']),
  languages:  new Set(),
};

// Intercept mutations so every change auto-marks the project as unsaved.
// These must be declared before any other module that calls db.strings.set,
// so the _orig* references are always available (used by deserializeDB).
const _origSet    = db.strings.set.bind(db.strings);
const _origDel    = db.strings.delete.bind(db.strings);
const _origCatAdd = db.categories.add.bind(db.categories);

db.strings.set    = (k, v) => { const r = _origSet(k, v);    markUnsaved(); return r; };
db.strings.delete = (k)    => { const r = _origDel(k);       markUnsaved(); return r; };
db.categories.add = (v)    => { const r = _origCatAdd(v);    markUnsaved(); return r; };


// ── UI state ─────────────────────────────────────────────────────────────────
// Single object that holds all transient view state.
// Modules read/write this directly; no getter/setter boilerplate needed at
// this scale.

const state = {
  activeCategory: '__ALL__',
  sortCol:    null,          // null = insertion order (never sorted by default)
  sortDir:    'asc',
  filters:    {},            // colKey -> filterString
  globalSearch: '',
  editingId:  null,          // id of the row currently in inline-edit mode
  hiddenCols: new Set(),     // colKeys hidden from the table view
  colWidths:  {},            // colKey -> px number
};
