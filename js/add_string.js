import { db } from './store.js';
import { closeModalForce, showModal } from './modal.js';
import { escHtml, getLangs, renderTable } from './render.js';
import { setStatus } from './utils.js';

export function openAddString() {
  showStringModal(null);
}

export function showStringModal(existing) {
  const langs = getLangs();
  const isEdit = !!existing;
  const s = existing || { id: '', category: [...db.categories][0] || 'general', notes: '', langs: {} };

  const langFields = langs.map(l => `
    <div class="form-group">
      <label class="form-label">${l.toUpperCase()}</label>
      <textarea class="form-input form-textarea" id="sf-lang-${l}" placeholder="Translation for ${l}...">${escHtml(s.langs[l] || '')}</textarea>
    </div>
  `).join('');

  const catOptions = [...db.categories].sort().map(c => `<option value="${escHtml(c)}" ${s.category===c?'selected':''}>${escHtml(c)}</option>`).join('');

  showModal(`
    <div class="modal modal-lg" onclick="event.stopPropagation()">
      <div class="modal-title">Add String</div>
      <div class="modal-sub">Create a new translation string.</div>
      <div class="form-group">
        <label class="form-label">String ID (KEY)</label>
        <input type="text" class="form-input" id="sf-id" value="${escHtml(s.id)}" placeholder="e.g. UI_BUTTON_OK" style="font-family:var(--mono)">
      </div>
      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-input form-select" id="sf-cat">${catOptions}</select>
      </div>
      <div class="lang-grid">
        ${langFields}
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-input form-textarea" id="sf-notes" placeholder="Context, hints...">${escHtml(s.notes || '')}</textarea>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModalForce()">Cancel</button>
        <button class="btn btn-primary" onclick="saveNewString()">Add String</button>
      </div>
    </div>
  `);
  setTimeout(() => document.getElementById('sf-id')?.focus(), 50);
}

export function saveNewString() {
  const id = document.getElementById('sf-id').value.trim();
  const category = document.getElementById('sf-cat').value;
  const notes = document.getElementById('sf-notes').value.trim();
  if (!id) { alert('String ID cannot be empty.'); return; }
  if (db.strings.has(id)) { alert(`String ID "${id}" already exists.`); return; }

  const langs = {};
  for (const l of getLangs()) {
    const el = document.getElementById(`sf-lang-${l}`);
    if (el) langs[l] = el.value.trim();
  }

  db.strings.set(id, { id, category, notes, langs });
  closeModalForce();
  renderTable();
  setStatus(`Added: ${id}`);
}

export function deleteString(id) {
  if (!confirm(`Delete string "${id}"?`)) return;
  db.strings.delete(id);
  renderTable();
  setStatus(`Deleted: ${id}`);
}

window.openAddString = openAddString;
window.showStringModal = showStringModal;
window.saveNewString = saveNewString;
window.deleteString = deleteString;
