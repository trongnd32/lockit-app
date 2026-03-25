import { db } from './store.js';
import { state } from './state.js';
import { getLangs, renderBody, renderTable } from './render.js';
import { setStatus } from './utils.js';

export function startEdit(id) {
  state.editingId = id;
  renderBody();
  // Focus the ID field
  const el = document.getElementById('ie-id');
  if (el) { el.focus(); el.select(); }
}

export function cancelEdit() {
  state.editingId = null;
  renderBody();
}

export function commitEdit(oldId) {
  const idEl = document.getElementById('ie-id');
  const catEl = document.getElementById('ie-cat');
  const notesEl = document.getElementById('ie-notes');
  if (!idEl) return;

  const newId = idEl.value.trim();
  const category = catEl ? catEl.value : (db.strings.get(oldId)?.category || 'general');
  const notes = notesEl ? notesEl.value.trim() : '';

  if (!newId) { idEl.focus(); idEl.style.borderColor = 'var(--accent2)'; return; }
  if (newId !== oldId && db.strings.has(newId)) {
    idEl.focus(); idEl.style.borderColor = 'var(--accent2)';
    alert(`String ID "${newId}" already exists.`); return;
  }

  const langs = {};
  for (const l of getLangs()) {
    const el = document.getElementById(`ie-lang-${l}`);
    if (el) langs[l] = el.value.trim();
    else langs[l] = db.strings.get(oldId)?.langs[l] || '';
  }

  if (newId !== oldId) db.strings.delete(oldId);
  db.strings.set(newId, { id: newId, category, notes, langs });

  state.editingId = null;
  renderTable();
  setStatus(`Saved: ${newId}`);
}

// Global keydown: Escape cancels edit
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && state.editingId) cancelEdit();
  if ((e.key === 'Enter') && (e.ctrlKey || e.metaKey) && state.editingId) commitEdit(state.editingId);
});

window.startEdit = startEdit;
window.cancelEdit = cancelEdit;
window.commitEdit = commitEdit;
