// ── Inline row edit ──────────────────────────────────────────────────────────

function startEdit(id) {
  state.editingId = id;
  repaintBody();
  const el = document.getElementById('ie-id');
  if (el) { el.focus(); el.select(); }
}

function cancelEdit() {
  state.editingId = null;
  repaintBody();
}

function commitEdit(oldId) {
  const idEl    = document.getElementById('ie-id');
  const catEl   = document.getElementById('ie-cat');
  const notesEl = document.getElementById('ie-notes');
  if (!idEl) return;

  const targetDb = state.viewMode === 'terminologies' ? db.terminologies : db.strings;
  const entryType = state.viewMode === 'terminologies' ? 'Terminology' : 'String';

  const newId    = idEl.value.trim();
  const category = catEl   ? catEl.value   : (targetDb.get(oldId)?.category || 'general');
  const notes    = notesEl ? notesEl.value.trim() : '';

  if (!newId) {
    idEl.focus(); idEl.style.borderColor = 'var(--accent2)'; return;
  }
  if (newId !== oldId && targetDb.has(newId)) {
    idEl.focus(); idEl.style.borderColor = 'var(--accent2)';
    alert(`${entryType} ID "${newId}" already exists.`); return;
  }

  const langs = {};
  for (const l of getLangs()) {
    const el = document.getElementById(`ie-lang-${l}`);
    langs[l] = el ? el.value.trim() : (targetDb.get(oldId)?.langs[l] || '');
  }

  if (newId !== oldId) targetDb.delete(oldId);
  targetDb.set(newId, { id: newId, category, notes, langs });

  state.editingId = null;
  renderTable();
  setStatus(`Saved: ${newId}`);
}

// ── Add string (modal) ────────────────────────────────────────────────────────

function openAddString() {
  const isTerm = state.viewMode === 'terminologies';
  const title = isTerm ? 'Add Terminology' : 'Add String';
  const sub = isTerm ? 'Create a new game terminology.' : 'Create a new translation string.';
  const idLabel = isTerm ? 'Terminology ID (KEY)' : 'String ID (KEY)';
  
  const langs      = getLangs();
  const langFields = langs.map(l => `
    <div class="form-group">
      <label class="form-label">${l.toUpperCase()}</label>
      <textarea class="form-input form-textarea" id="sf-lang-${l}" placeholder="Translation for ${l}..."></textarea>
    </div>`).join('');

  const catOptions = [...db.categories].sort()
    .map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');

  showModal(`
    <div class="modal modal-lg" onclick="event.stopPropagation()">
      <div class="modal-title">${title}</div>
      <div class="modal-sub">${sub}</div>
      <div class="form-group">
        <label class="form-label">${idLabel}</label>
        <input type="text" class="form-input" id="sf-id" placeholder="e.g. UI_BUTTON_OK" style="font-family:var(--mono)">
      </div>
      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-input form-select" id="sf-cat">${catOptions}</select>
      </div>
      <div class="lang-grid">${langFields}</div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-input form-textarea" id="sf-notes" placeholder="Context, hints..."></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModalForce()">Cancel</button>
        <button class="btn btn-primary" onclick="saveNewString()">Add String</button>
      </div>
    </div>`);
  setTimeout(() => document.getElementById('sf-id')?.focus(), 50);
}

function saveNewString() {
  const id       = document.getElementById('sf-id').value.trim();
  const category = document.getElementById('sf-cat').value;
  const notes    = document.getElementById('sf-notes').value.trim();
  
  const targetDb = state.viewMode === 'terminologies' ? db.terminologies : db.strings;
  const entryType = state.viewMode === 'terminologies' ? 'Terminology' : 'String';

  if (!id) { alert(`${entryType} ID cannot be empty.`); return; }
  if (targetDb.has(id)) { alert(`${entryType} ID "${id}" already exists.`); return; }

  const langs = {};
  for (const l of getLangs()) {
    const el = document.getElementById(`sf-lang-${l}`);
    if (el) langs[l] = el.value.trim();
  }

  targetDb.set(id, { id, category, notes, langs });
  closeModalForce();
  renderTable();
  setStatus(`Added: ${id}`);
}

function deleteString(id) {
  const targetDb = state.viewMode === 'terminologies' ? db.terminologies : db.strings;
  const entryType = state.viewMode === 'terminologies' ? 'terminology' : 'string';
  if (!confirm(`Delete ${entryType} "${id}"?`)) return;
  targetDb.delete(id);
  renderTable();
  setStatus(`Deleted: ${id}`);
}

// ── Add category ──────────────────────────────────────────────────────────────

function openAddCategory() {
  showModal(`
    <div class="modal modal-sm" onclick="event.stopPropagation()">
      <div class="modal-title">Add Category</div>
      <div class="form-group" style="margin-top:12px">
        <label class="form-label">Category Name</label>
        <input type="text" class="form-input" id="new-cat-name" placeholder="e.g. skills, dialogue, items...">
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModalForce()">Cancel</button>
        <button class="btn btn-primary" onclick="addCategory()">Add</button>
      </div>
    </div>`);
  setTimeout(() => document.getElementById('new-cat-name')?.focus(), 50);
}

function addCategory() {
  const name = document.getElementById('new-cat-name').value.trim()
    .toLowerCase().replace(/\s+/g, '_');
  if (!name) return;
  db.categories.add(name);
  closeModalForce();
  renderTable();
  setStatus(`Category added: ${name}`);
}
