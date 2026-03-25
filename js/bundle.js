// ===========================
// DATA STORE (in-memory DB)
// ===========================
const db = {
  strings: new Map(),   // KEY -> { id, category, notes, langs: {en: "...", vi: "..."} }
  categories: new Set(['general']),
  languages: new Set(),
};

// ===========================
// STATE
// ===========================
let state = {
  activeCategory: '__ALL__',
  sortCol: null,
  sortDir: 'asc',
  filters: {},
  globalSearch: '',
  editingId: null,
  hiddenCols: new Set(),
  colWidths: {},   // col key -> px width
};

// ===========================
// UTILS
// ===========================
function parseCSV(text) {
  const lines = [];
  let cur = '', inQ = false;
  const rows = [];
  let cells = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQ && text[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      cells.push(cur); cur = '';
    } else if ((c === '\n' || c === '\r') && !inQ) {
      if (c === '\r' && text[i+1] === '\n') i++;
      cells.push(cur); cur = '';
      if (cells.some(x => x !== '') || rows.length === 0) rows.push(cells);
      cells = [];
    } else cur += c;
  }
  cells.push(cur);
  if (cells.some(x => x !== '')) rows.push(cells);
  return rows;
}

function toCSV(rows) {
  return rows.map(r => r.map(c => {
    const s = String(c ?? '');
    return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(',')).join('\n');
}

function setStatus(msg) {
  document.getElementById('footer-status').textContent = msg;
}

// ===========================
// RENDER
// ===========================
function getLangs() {
  return [...db.languages].sort();
}

function getVisibleStrings() {
  const gs = state.globalSearch.toLowerCase().trim();
  const filtered = [...db.strings.values()].filter(s => {
    if (state.activeCategory !== '__ALL__' && s.category !== state.activeCategory) return false;
    // per-column filters
    for (const [col, val] of Object.entries(state.filters)) {
      if (!val) continue;
      const v = val.toLowerCase();
      if (col === 'id' && !s.id.toLowerCase().includes(v)) return false;
      if (col === 'category' && !s.category.toLowerCase().includes(v)) return false;
      if (col === 'notes' && !(s.notes||'').toLowerCase().includes(v)) return false;
      if (col.startsWith('lang_')) {
        const lang = col.slice(5);
        if (!(s.langs[lang]||'').toLowerCase().includes(v)) return false;
      }
    }
    // global
    if (gs) {
      const haystack = [s.id, s.category, s.notes||'', ...Object.values(s.langs)].join(' ').toLowerCase();
      if (!haystack.includes(gs)) return false;
    }
    return true;
  });

  // Only sort when user has explicitly chosen a column; otherwise keep Map insertion order
  if (!state.sortCol) return filtered;

  return filtered.sort((a, b) => {
    const dir = state.sortDir === 'asc' ? 1 : -1;
    const col = state.sortCol;
    let av, bv;
    if (col === 'id') { av = a.id; bv = b.id; }
    else if (col === 'category') { av = a.category; bv = b.category; }
    else if (col.startsWith('lang_')) { const l = col.slice(5); av = a.langs[l]||''; bv = b.langs[l]||''; }
    else { av = ''; bv = ''; }
    return av < bv ? -dir : av > bv ? dir : 0;
  });
}

function buildHeaders() {
  const langs = getLangs();
  const all = [
    { key: 'id',       label: 'String ID' },
    { key: 'category', label: 'Category' },
    ...langs.map(l => ({ key: `lang_${l}`, label: l.toUpperCase() })),
    { key: 'notes',    label: 'Notes' },
    { key: '_actions', label: '' },
  ];
  // Always keep id and _actions; hide anything in hiddenCols
  return all.filter(c => c.key === 'id' || c.key === '_actions' || !state.hiddenCols.has(c.key));
}

// Full render: rebuilds headers + filter row + tbody
// Only called on structural changes (new cols, sort, category switch, load)
function renderTable() {
  state.globalSearch = document.getElementById('global-search').value;
  const cols = buildHeaders();

  // Header
  const hr = document.getElementById('header-row');
  hr.innerHTML = cols.map(c => {
    if (c.key === '_actions') {
      const w = state.colWidths['_actions'] || 110;
      return `<th style="width:${w}px"></th>`;
    }
    const isSort = state.sortCol === c.key;
    const cls = ['sortable', isSort ? (state.sortDir === 'asc' ? 'sort-asc' : 'sort-desc') : ''].join(' ');
    const w = state.colWidths[c.key];
    const wStyle = w ? `width:${w}px;` : '';
    return `<th class="${cls}" style="${wStyle}" data-col="${c.key}" onclick="handleThClick(event,'${c.key}')">${c.label}<span class="sort-icon"></span><div class="col-resize-handle" data-resize="${c.key}" onmousedown="startColResize(event,'${c.key}')"></div></th>`;
  }).join('');

  // Filter row — attach listeners via JS (not inline oninput) to avoid re-render losing focus
  const fr = document.getElementById('filter-row');
  fr.innerHTML = cols.map(c => {
    if (c.key === '_actions') return `<th></th>`;
    const val = state.filters[c.key] || '';
    return `<th><input data-fcol="${c.key}" placeholder="filter…" value="${escHtml(val)}"></th>`;
  }).join('');
  fr.querySelectorAll('input[data-fcol]').forEach(inp => {
    inp.addEventListener('input', () => {
      state.filters[inp.dataset.fcol] = inp.value;
      renderBody(cols); // only re-render body, keep focus
      updateStats();
      renderSidebar();
    });
  });

  renderBody(cols);
  updateStats();
  renderSidebar();
  // Keep the column toggle button label in sync (e.g. after import adds new langs)
  const dropdown = document.getElementById('col-dropdown');
  if (dropdown && dropdown.style.display !== 'none') renderColDropdown();
  else {
    const label = document.getElementById('col-toggle-label');
    const btn = document.getElementById('col-toggle-btn');
    if (label) label.textContent = state.hiddenCols.size ? `Columns (${state.hiddenCols.size} hidden)` : 'Columns';
    if (btn) btn.classList.toggle('active', state.hiddenCols.size > 0);
  }
}

// Partial render: only rebuilds tbody rows (keeps filter row DOM intact = no focus loss)
function renderBody(cols) {
  cols = cols || buildHeaders();
  const rows = getVisibleStrings();
  const tbody = document.getElementById('table-body');

  if (rows.length === 0) {
    tbody.innerHTML = '';
    document.getElementById('empty-state').style.display = db.strings.size === 0 ? 'flex' : 'none';
    document.querySelector('.table-wrap table').style.display = db.strings.size === 0 ? 'none' : '';
    document.getElementById('row-count').textContent = `0 / ${db.strings.size} strings`;
    return;
  }

  document.getElementById('empty-state').style.display = 'none';
  document.querySelector('.table-wrap table').style.display = '';

  // Build HTML for all rows
  const htmlParts = [];
  for (const s of rows) {
    if (state.editingId === s.id) {
      htmlParts.push(buildEditRow(s, cols));
    } else {
      htmlParts.push(buildViewRow(s, cols));
    }
  }
  tbody.innerHTML = htmlParts.join('');
  document.getElementById('row-count').textContent = `${rows.length} / ${db.strings.size} strings`;
}

function buildViewRow(s, cols) {
  const cells = cols.map(c => {
    if (c.key === 'id') return `<td class="key-cell">${escHtml(s.id)}</td>`;
    if (c.key === 'category') return `<td><span class="cat-badge">${escHtml(s.category)}</span></td>`;
    if (c.key === '_actions') return `<td><div class="actions-cell">
      <button class="btn btn-ghost btn-sm" onclick='startEdit(${JSON.stringify(s.id)})'>Edit</button>
      <button class="btn btn-danger btn-sm" onclick='deleteString(${JSON.stringify(s.id)})'>Del</button>
    </div></td>`;
    if (c.key === 'notes') return `<td style="color:var(--text-muted);font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(s.notes||'')}</td>`;
    if (c.key.startsWith('lang_')) {
      const lang = c.key.slice(5);
      const val = s.langs[lang] || '';
      return `<td class="lang-cell ${val ? '' : 'empty'}">${val ? escHtml(val) : '—'}</td>`;
    }
    return '<td></td>';
  }).join('');
  return `<tr data-id="${escHtml(s.id)}">${cells}</tr>`;
}

function buildEditRow(s, cols) {
  // Main edit row: ID, category, lang cols (as textareas), notes, actions
  const catOptions = [...db.categories].sort().map(c =>
    `<option value="${escHtml(c)}" ${s.category===c?'selected':''}>${escHtml(c)}</option>`
  ).join('');

  const cells = cols.map(c => {
    if (c.key === 'id') return `<td><input class="inline-edit-input mono" id="ie-id" value="${escHtml(s.id)}"></td>`;
    if (c.key === 'category') return `<td><select class="inline-edit-select" id="ie-cat">${catOptions}</select></td>`;
    if (c.key === '_actions') return `<td><div class="actions-cell">
      <button class="btn btn-primary btn-sm" onclick='commitEdit(${JSON.stringify(s.id)})'>Save</button>
      <button class="btn btn-ghost btn-sm" onclick='cancelEdit()'>Cancel</button>
    </div></td>`;
    if (c.key === 'notes') return `<td><textarea class="inline-edit-textarea" id="ie-notes" rows="2" placeholder="Notes…">${escHtml(s.notes||'')}</textarea></td>`;
    if (c.key.startsWith('lang_')) {
      const lang = c.key.slice(5);
      const val = s.langs[lang] || '';
      return `<td><textarea class="inline-edit-textarea" id="ie-lang-${lang}" rows="3" placeholder="${lang}…">${escHtml(val)}</textarea></td>`;
    }
    return '<td></td>';
  }).join('');

  return `<tr class="editing" data-id="${escHtml(s.id)}">${cells}</tr>`;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toggleSort(col) {
  if (state.sortCol === col) {
    if (state.sortDir === 'asc') {
      state.sortDir = 'desc';
    } else {
      // Third click: clear sort, revert to insertion order
      state.sortCol = null;
      state.sortDir = 'asc';
    }
  } else {
    state.sortCol = col;
    state.sortDir = 'asc';
  }
  renderTable();
}

function setFilter(col, val) {
  state.filters[col] = val;
  renderBody();
  updateStats();
  renderSidebar();
}

function onGlobalSearch() {
  state.globalSearch = document.getElementById('global-search').value;
  renderBody();
  updateStats();
  renderSidebar();
}

function renderSidebar() {
  const catList = document.getElementById('cat-list');
  const allCount = db.strings.size;
  let html = `<div class="cat-item ${state.activeCategory === '__ALL__' ? 'active' : ''}" data-cat="__ALL__" onclick="setCategory('__ALL__')">
    <span>All Strings</span><span class="cat-count">${allCount}</span>
  </div>`;
  for (const cat of [...db.categories].sort()) {
    const count = [...db.strings.values()].filter(s => s.category === cat).length;
    html += `<div class="cat-item ${state.activeCategory === cat ? 'active' : ''}" data-cat="${escHtml(cat)}" onclick="setCategory('${escHtml(cat)}')">
      <span>${escHtml(cat)}</span><span class="cat-count">${count}</span>
    </div>`;
  }
  catList.innerHTML = html;
}

function setCategory(cat) {
  state.activeCategory = cat;
  state.filters = {};
  state.editingId = null;
  renderTable();
}

function updateStats() {
  document.getElementById('stat-strings').textContent = db.strings.size;
  document.getElementById('stat-langs').textContent = db.languages.size;
  document.getElementById('stat-cats').textContent = db.categories.size;
}

// ===========================
// COLUMN VISIBILITY
// ===========================
function getToggleableCols() {
  // All columns except id and _actions
  const langs = getLangs();
  return [
    { key: 'category', label: 'Category' },
    ...langs.map(l => ({ key: `lang_${l}`, label: l.toUpperCase() })),
    { key: 'notes', label: 'Notes' },
  ];
}

function toggleColDropdown() {
  const dropdown = document.getElementById('col-dropdown');
  const btn = document.getElementById('col-toggle-btn');
  const isOpen = dropdown.style.display !== 'none';
  if (isOpen) {
    dropdown.style.display = 'none';
    btn.classList.remove('active');
  } else {
    renderColDropdown();
    dropdown.style.display = 'block';
    btn.classList.add('active');
  }
}

function renderColDropdown() {
  const cols = getToggleableCols();
  const hiddenCount = state.hiddenCols.size;
  const allHidden = cols.every(c => state.hiddenCols.has(c.key));

  const items = cols.map(c => {
    const isHidden = state.hiddenCols.has(c.key);
    return `<div class="col-toggle-item ${isHidden ? 'is-hidden' : ''}" onclick="toggleColVisibility('${c.key}')">
      <input type="checkbox" ${isHidden ? '' : 'checked'} onclick="event.stopPropagation();toggleColVisibility('${c.key}')">
      <label>${c.label}</label>
    </div>`;
  }).join('');

  document.getElementById('col-dropdown').innerHTML = `
    <div class="col-dropdown-header">
      <span>Show / Hide</span>
      <button onclick="resetColVisibility()">Show all</button>
    </div>
    ${items}
  `;

  // Update button label
  const label = document.getElementById('col-toggle-label');
  if (hiddenCount > 0) {
    label.textContent = `Columns (${hiddenCount} hidden)`;
    document.getElementById('col-toggle-btn').classList.add('active');
  } else {
    label.textContent = 'Columns';
  }
}

function toggleColVisibility(key) {
  if (state.hiddenCols.has(key)) {
    state.hiddenCols.delete(key);
  } else {
    state.hiddenCols.add(key);
  }
  if (state.hiddenCols.has(key)) delete state.filters[key];
  savePrefs();
  renderColDropdown();
  renderTable();
}

function resetColVisibility() {
  state.hiddenCols.clear();
  savePrefs();
  renderColDropdown();
  renderTable();
}

// Close dropdown when clicking outside
document.addEventListener('click', e => {
  const wrap = document.getElementById('col-toggle-wrap');
  if (wrap && !wrap.contains(e.target)) {
    const dropdown = document.getElementById('col-dropdown');
    const btn = document.getElementById('col-toggle-btn');
    if (dropdown) dropdown.style.display = 'none';
    if (btn && !state.hiddenCols.size) btn.classList.remove('active');
  }
});

// ===========================
// INLINE ROW EDIT
// ===========================
function startEdit(id) {
  state.editingId = id;
  renderBody();
  // Focus the ID field
  const el = document.getElementById('ie-id');
  if (el) { el.focus(); el.select(); }
}

function cancelEdit() {
  state.editingId = null;
  renderBody();
}

function commitEdit(oldId) {
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

// ===========================
// MODAL HELPERS
// ===========================
function showModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-overlay" onclick="closeModal(event)">${html}</div>`;
}

function closeModal(e) {
  if (!e || e.target.classList.contains('modal-overlay')) {
    document.getElementById('modal-root').innerHTML = '';
  }
}

function closeModalForce() {
  document.getElementById('modal-root').innerHTML = '';
}

// ===========================
// IMPORT CSV
// ===========================
function openImport() {
  showModal(`
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-title">Import CSV</div>
      <div class="modal-sub">Import strings from a CSV file. First row must be headers; "KEY" column required.</div>
      <div class="file-drop" id="drop-zone" onclick="document.getElementById('csv-file-input').click()"
        ondragover="event.preventDefault();this.classList.add('drag')"
        ondragleave="this.classList.remove('drag')"
        ondrop="handleFileDrop(event)">
        <div class="drop-icon">📂</div>
        <p>Click to browse or drag & drop a CSV file</p>
        <p id="drop-filename" style="margin-top:6px;color:var(--accent);font-family:var(--mono);font-size:12px"></p>
      </div>
      <input type="file" id="csv-file-input" accept=".csv,text/csv" style="display:none" onchange="handleFileSelect(this)">
      <div class="form-group" style="margin-top:16px">
        <label class="form-label">Assign to Category</label>
        <div class="tag-input-wrap">
          <select id="import-cat-select" class="form-input form-select">
            ${[...db.categories].sort().map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('')}
            <option value="__new__">+ New category...</option>
          </select>
        </div>
        <input type="text" id="import-cat-new" class="form-input" placeholder="New category name" style="margin-top:6px;display:none">
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModalForce()">Cancel</button>
        <button class="btn btn-primary" onclick="doImport()" id="import-btn" disabled>Import</button>
      </div>
    </div>
  `);
  document.getElementById('import-cat-select').addEventListener('change', function() {
    document.getElementById('import-cat-new').style.display = this.value === '__new__' ? 'block' : 'none';
  });
}

let pendingFile = null;

function handleFileDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file) loadFileForImport(file);
}

function handleFileSelect(input) {
  const file = input.files[0];
  if (file) loadFileForImport(file);
}

function loadFileForImport(file) {
  pendingFile = file;
  document.getElementById('drop-filename').textContent = file.name;
  document.getElementById('import-btn').disabled = false;
  document.getElementById('drop-zone').querySelector('p').textContent = 'File loaded. Ready to import.';
}

function doImport() {
  if (!pendingFile) return;
  const catSelect = document.getElementById('import-cat-select').value;
  let category = catSelect === '__new__'
    ? (document.getElementById('import-cat-new').value.trim() || 'general')
    : catSelect;
  category = category.toLowerCase().replace(/\s+/g, '_');

  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    processImport(text, category);
  };
  reader.readAsText(pendingFile, 'utf-8');
  pendingFile = null;
}

function processImport(text, category) {
  const rows = parseCSV(text);
  if (rows.length < 2) { alert('CSV is empty or has no data rows.'); return; }

  const headers = rows[0].map(h => h.trim());
  const keyIdx = headers.findIndex(h => h.toUpperCase() === 'KEY');
  if (keyIdx === -1) { alert('No "KEY" column found in CSV.'); return; }

  // Detect language columns: not KEY, not NOTES/NOTE, not empty
  const notesIdx = headers.findIndex(h => /^notes?$/i.test(h));
  const langCols = headers.reduce((acc, h, i) => {
    if (i === keyIdx || i === notesIdx) return acc;
    if (!h || /^notes?$/i.test(h)) return acc;
    // ISO-like or any non-empty header is treated as language code
    acc.push({ idx: i, code: h.trim().toLowerCase() });
    return acc;
  }, []);

  db.categories.add(category);

  const conflicts = []; // {key, lang, old, new}
  const newKeys = [];
  let added = 0, updated = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const key = (row[keyIdx] || '').trim();
    if (!key) continue;

    const langs = {};
    langCols.forEach(lc => { langs[lc.code] = (row[lc.idx] || '').trim(); });
    const notes = notesIdx >= 0 ? (row[notesIdx] || '').trim() : '';

    langCols.forEach(lc => db.languages.add(lc.code));

    if (db.strings.has(key)) {
      const existing = db.strings.get(key);
      // check for translation conflicts
      for (const lc of langCols) {
        const newVal = langs[lc.code];
        const oldVal = existing.langs[lc.code] || '';
        if (newVal && oldVal && newVal !== oldVal) {
          conflicts.push({ key, lang: lc.code, old: oldVal, new: newVal });
        }
      }
      if (conflicts.filter(c => c.key === key).length === 0) {
        // No conflicts, merge silently
        Object.assign(existing.langs, langs);
        if (notes) existing.notes = notes;
        updated++;
      }
    } else {
      newKeys.push({ key, category, langs, notes });
      added++;
    }
  }

  // Add non-conflicting new strings first
  newKeys.forEach(({ key, category, langs, notes }) => {
    db.strings.set(key, { id: key, category, notes, langs });
  });

  closeModalForce();
  renderTable();

  if (conflicts.length > 0) {
    showConflictDialog(conflicts, () => {
      setStatus(`Imported: +${added} new, ~${updated} merged, ${conflicts.length} conflicts resolved`);
    });
  } else {
    setStatus(`Imported: +${added} new, ~${updated} updated from "${category}"`);
  }
}

function showConflictDialog(conflicts, onDone) {
  // Group by key
  const byKey = {};
  conflicts.forEach(c => { (byKey[c.key] = byKey[c.key] || []).push(c); });

  const conflictHtml = Object.entries(byKey).map(([key, items]) => `
    <div class="conflict-item">
      <div class="conflict-key">${escHtml(key)}</div>
      ${items.map(c => `
        <div class="conflict-vals">
          <div class="conflict-old"><div class="conflict-lang">${c.lang} — current</div>${escHtml(c.old)}</div>
          <div class="conflict-new"><div class="conflict-lang">${c.lang} — incoming</div>${escHtml(c.new)}</div>
        </div>
      `).join('')}
    </div>
  `).join('');

  showModal(`
    <div class="modal modal-lg" onclick="event.stopPropagation()">
      <div class="modal-title">⚠ Translation Conflicts</div>
      <div class="modal-sub">${conflicts.length} conflict(s) found in ${Object.keys(byKey).length} string(s). Choose which translations to keep.</div>
      <div class="warn-box">Existing translations differ from incoming values. Keep current or replace with incoming?</div>
      <div style="max-height:320px;overflow-y:auto">${conflictHtml}</div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="resolveConflicts('keep');${onDone ? 'resolveConflictsDone()' : ''}">Keep Current</button>
        <button class="btn btn-primary" onclick="resolveConflicts('replace',${JSON.stringify(conflicts)})">Replace with Incoming</button>
      </div>
    </div>
  `);
  window._conflictData = conflicts;
  window._conflictDone = onDone;
}

function resolveConflicts(action) {
  if (action === 'replace' && window._conflictData) {
    window._conflictData.forEach(c => {
      if (db.strings.has(c.key)) {
        db.strings.get(c.key).langs[c.lang] = c.new;
      }
    });
  }
  closeModalForce();
  renderTable();
  if (window._conflictDone) window._conflictDone();
}

// ===========================
// ADD STRING (modal, for new only)
// ===========================
function openAddString() {
  showStringModal(null);
}

function showStringModal(existing) {
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

function saveNewString() {
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

function deleteString(id) {
  if (!confirm(`Delete string "${id}"?`)) return;
  db.strings.delete(id);
  renderTable();
  setStatus(`Deleted: ${id}`);
}

// ===========================
// ADD CATEGORY
// ===========================
function openAddCategory() {
  showModal(`
    <div class="modal modal-sm" onclick="event.stopPropagation()">
      <div class="modal-title">Add Category</div>
      <div class="form-group" style="margin-top:12px">
        <label class="form-label">Category Name</label>
        <input type="text" class="form-input" id="new-cat-name" placeholder="e.g. skills, dialogue, items..." autofocus>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModalForce()">Cancel</button>
        <button class="btn btn-primary" onclick="addCategory()">Add</button>
      </div>
    </div>
  `);
  setTimeout(() => document.getElementById('new-cat-name')?.focus(), 50);
}

function addCategory() {
  const name = document.getElementById('new-cat-name').value.trim().toLowerCase().replace(/\s+/g,'_');
  if (!name) return;
  db.categories.add(name);
  closeModalForce();
  renderTable();
  setStatus(`Category added: ${name}`);
}

// ===========================
// EXPORT CSV
// ===========================
function openExportDialog() {
  if (db.strings.size === 0) { alert('No strings to export.'); return; }

  // Build available columns: KEY always first, then languages, then NOTES
  const langs = getLangs();
  // exportCols: array of {id, label, type, enabled}
  // Stored on window so drag handlers can mutate it
  window._exportCols = [
    { id: 'KEY',   label: 'KEY (String ID)', type: 'required', enabled: true },
    ...langs.map(l => ({ id: l, label: l.toUpperCase(), type: 'language', enabled: true })),
    { id: 'NOTES', label: 'NOTES',            type: 'meta',     enabled: true },
  ];

  renderExportDialog();
}

function renderExportDialog() {
  const cols = window._exportCols;
  const enabledCount = cols.filter(c => c.enabled).length;

  const itemsHtml = cols.map((c, i) => {
    const isRequired = c.id === 'KEY';
    return `
      <div class="col-picker-item" draggable="true"
        data-idx="${i}"
        ondragstart="exportDragStart(event,${i})"
        ondragover="exportDragOver(event,${i})"
        ondragleave="exportDragLeave(event,${i})"
        ondrop="exportDrop(event,${i})"
        ondragend="exportDragEnd(event)">
        <span class="col-picker-drag-handle">⠿</span>
        <input class="col-picker-check" type="checkbox" ${c.enabled ? 'checked' : ''} ${isRequired ? 'disabled' : ''}
          onchange="exportToggleCol(${i}, this.checked)">
        <span class="col-picker-label ${c.id === 'KEY' ? 'key-col' : ''}">${c.label}</span>
        <span class="col-picker-type">${c.type}</span>
      </div>
    `;
  }).join('');

  const modalHtml = `
    <div class="modal" onclick="event.stopPropagation()" style="width:460px">
      <div class="modal-title">↓ Export CSV</div>
      <div class="modal-sub">Choose and reorder columns. Drag rows to reorder. KEY column is always included.</div>
      <div class="picker-actions-row">
        <button onclick="exportSelectAll(true)">Select all</button>
        <button onclick="exportSelectAll(false)">Deselect all</button>
        <span style="margin-left:auto;font-family:var(--mono);font-size:11px;color:var(--text-muted)">${enabledCount} of ${cols.length} columns</span>
      </div>
      <div class="col-picker-list" id="export-col-list">${itemsHtml}</div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModalForce()">Cancel</button>
        <button class="btn btn-export" onclick="doExportCSV()" style="padding:7px 18px;font-size:12px">↓ Download CSV</button>
      </div>
    </div>
  `;
  showModal(modalHtml);
}

let _dragSrcIdx = null;

function exportDragStart(e, idx) {
  _dragSrcIdx = idx;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function exportDragOver(e, idx) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (idx !== _dragSrcIdx) e.currentTarget.classList.add('drag-over');
}

function exportDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function exportDrop(e, idx) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (_dragSrcIdx === null || _dragSrcIdx === idx) return;
  const cols = window._exportCols;
  const [moved] = cols.splice(_dragSrcIdx, 1);
  cols.splice(idx, 0, moved);
  _dragSrcIdx = null;
  renderExportDialog();
}

function exportDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  _dragSrcIdx = null;
  // clean up any leftover drag-over classes
  document.querySelectorAll('.col-picker-item').forEach(el => el.classList.remove('drag-over'));
}

function exportToggleCol(idx, val) {
  window._exportCols[idx].enabled = val;
  // Update count label without full re-render (avoids losing drag state)
  const cols = window._exportCols;
  const enabledCount = cols.filter(c => c.enabled).length;
  const countEl = document.querySelector('.picker-actions-row span');
  if (countEl) countEl.textContent = `${enabledCount} of ${cols.length} columns`;
}

function exportSelectAll(val) {
  window._exportCols.forEach(c => { if (c.id !== 'KEY') c.enabled = val; });
  renderExportDialog();
}

function doExportCSV() {
  const cols = window._exportCols.filter(c => c.enabled);
  if (!cols.find(c => c.id === 'KEY')) cols.unshift(window._exportCols.find(c => c.id === 'KEY'));

  const headers = cols.map(c => c.id === 'KEY' ? 'KEY' : c.id === 'NOTES' ? 'NOTES' : c.id);
  const csvRows = [headers];

  for (const s of db.strings.values()) {
    csvRows.push(cols.map(c => {
      if (c.id === 'KEY')   return s.id;
      if (c.id === 'NOTES') return s.notes || '';
      return s.langs[c.id] || '';
    }));
  }

  const csv = toCSV(csvRows);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentProjectName || 'strings'}_export.csv`;
  a.click();
  URL.revokeObjectURL(url);
  closeModalForce();
  setStatus(`Exported ${db.strings.size} strings · ${cols.length} columns`);
}

// ===========================
// SAVE / LOAD PROJECT
// ===========================
const PROJECT_VERSION = 1;
let currentProjectName = null;
let hasUnsavedChanges = false;

function markUnsaved() {
  hasUnsavedChanges = true;
  const ind = document.getElementById('save-indicator');
  const lbl = document.getElementById('save-label');
  if (ind) ind.className = 'save-indicator unsaved';
  if (lbl) lbl.textContent = currentProjectName ? `${currentProjectName} *` : 'unsaved *';
}

function markSaved(name) {
  hasUnsavedChanges = false;
  currentProjectName = name;
  const ind = document.getElementById('save-indicator');
  const lbl = document.getElementById('save-label');
  if (ind) ind.className = 'save-indicator saved';
  if (lbl) lbl.textContent = name;
  // Briefly flash saved, then settle
  setTimeout(() => { if (ind) ind.className = 'save-indicator'; }, 2000);
}

function serializeDB() {
  return {
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    categories: [...db.categories],
    languages: [...db.languages],
    strings: [...db.strings.values()],
  };
}

function deserializeDB(data) {
  if (!data || !data.strings) throw new Error('Invalid project file.');
  db.strings.clear();
  db.categories.clear();
  db.languages.clear();

  (data.categories || []).forEach(c => db.categories.add(c));
  (data.languages || []).forEach(l => db.languages.add(l));
  data.strings.forEach(s => {
    db.strings.set(s.id, {
      id: s.id,
      category: s.category || 'general',
      notes: s.notes || '',
      langs: s.langs || {},
    });
  });
}

function saveProject() {
  if (db.strings.size === 0) { alert('Nothing to save — database is empty.'); return; }

  const name = currentProjectName || 'my_project';
  const json = JSON.stringify(serializeDB(), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.lockit.json`;
  a.click();
  URL.revokeObjectURL(url);
  markSaved(name);
  setStatus(`Project saved: ${name}.lockit.json`);
}

function openLoadProject() {
  const warnHtml = hasUnsavedChanges
    ? `<div class="warn-box">⚠ You have unsaved changes. Loading a project will replace the current database.</div>`
    : '';

  const recent = getRecentProjects();
  const recentHtml = recent.length ? `
    <div style="margin-bottom:16px">
      <div style="font-family:var(--mono);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-muted);margin-bottom:8px">Recent Projects</div>
      <div class="recent-list">
        ${recent.map(r => `
          <div class="recent-item" title="${escHtml(r.name)}.lockit.json">
            <span style="font-size:14px">📄</span>
            <span class="recent-item-name">${escHtml(r.name)}</span>
            <span class="recent-item-time">${formatRelTime(r.loadedAt)}</span>
            <span style="font-size:11px;color:var(--text-muted);cursor:pointer;padding:2px 4px" title="Remove from recent" onclick="event.stopPropagation();removeRecentProject('${escHtml(r.name)}');openLoadProject()">✕</span>
          </div>
        `).join('')}
      </div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--text-muted);margin-bottom:12px">↑ Recently loaded — browse to load again</div>
    </div>
  ` : '';

  showModal(`
    <div class="modal" onclick="event.stopPropagation()" style="width:480px">
      <div class="modal-title">Load Project</div>
      <div class="modal-sub">Open a <code style="font-family:var(--mono);color:var(--accent)">.lockit.json</code> project file.</div>
      ${warnHtml}
      ${recentHtml}
      <div class="file-drop" id="load-drop-zone" onclick="document.getElementById('json-file-input').click()"
        ondragover="event.preventDefault();this.classList.add('drag')"
        ondragleave="this.classList.remove('drag')"
        ondrop="handleLoadDrop(event)">
        <div class="drop-icon">📁</div>
        <p>Click to browse or drag & drop a .lockit.json file</p>
        <p id="load-filename" style="margin-top:6px;color:var(--accent);font-family:var(--mono);font-size:12px"></p>
      </div>
      <input type="file" id="json-file-input" accept=".json,application/json" style="display:none" onchange="handleLoadSelect(this)">
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModalForce()">Cancel</button>
        <button class="btn btn-primary" id="load-btn" disabled onclick="doLoadProject()">Load File</button>
      </div>
    </div>
  `);
}

let pendingLoadFile = null;

function handleLoadDrop(e) {
  e.preventDefault();
  document.getElementById('load-drop-zone').classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file) prepareLoadFile(file);
}

function handleLoadSelect(input) {
  const file = input.files[0];
  if (file) prepareLoadFile(file);
}

function prepareLoadFile(file) {
  pendingLoadFile = file;
  document.getElementById('load-filename').textContent = file.name;
  document.getElementById('load-btn').disabled = false;
  document.getElementById('load-drop-zone').querySelector('p').textContent = 'File ready. Click Load to continue.';
}

function doLoadProject() {
  if (!pendingLoadFile) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      deserializeDB(data);
      const fname = pendingLoadFile.name.replace(/\.lockit\.json$/i, '').replace(/\.json$/i, '');
      pendingLoadFile = null;
      state.activeCategory = '__ALL__';
      state.filters = {};
      closeModalForce();
      renderTable();
      markSaved(fname);
      pushRecentProject(fname);
      setStatus(`Loaded project: ${fname} — ${db.strings.size} strings, ${db.languages.size} languages`);
    } catch (err) {
      alert(`Failed to load project: ${err.message}`);
    }
  };
  reader.readAsText(pendingLoadFile, 'utf-8');
}

// Intercept all mutations to mark unsaved
const _origSet = db.strings.set.bind(db.strings);
db.strings.set = function(k, v) { const r = _origSet(k, v); markUnsaved(); return r; };
const _origDel = db.strings.delete.bind(db.strings);
db.strings.delete = function(k) { const r = _origDel(k); markUnsaved(); return r; };
const _origCatAdd = db.categories.add.bind(db.categories);
db.categories.add = function(v) { const r = _origCatAdd(v); markUnsaved(); return r; };

// Warn on tab close if unsaved
window.addEventListener('beforeunload', e => {
  if (hasUnsavedChanges && db.strings.size > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ===========================
// COLUMN RESIZE
// ===========================
let _resizeState = null;

function handleThClick(e, col) {
  // Ignore if the click was on the resize handle
  if (e.target.classList.contains('col-resize-handle')) return;
  toggleSort(col);
}

function startColResize(e, col) {
  e.preventDefault();
  e.stopPropagation();
  const th = e.target.closest('th');
  const startX = e.clientX;
  const startW = th.offsetWidth;
  const handle = e.target;
  handle.classList.add('active');

  _resizeState = { col, startX, startW };

  function onMove(ev) {
    const delta = ev.clientX - startX;
    const newW = Math.max(60, startW + delta);
    state.colWidths[col] = newW;
    // Apply directly to the th for smooth drag (no full re-render)
    th.style.width = newW + 'px';
    savePrefs();
  }

  function onUp() {
    handle.classList.remove('active');
    _resizeState = null;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// ===========================
// RECENT PROJECTS (localStorage)
// ===========================
const RECENT_KEY = 'lockit_recent_projects';
const MAX_RECENT = 8;

function getRecentProjects() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
  catch { return []; }
}

function pushRecentProject(name) {
  let list = getRecentProjects().filter(r => r.name !== name);
  list.unshift({ name, loadedAt: Date.now() });
  if (list.length > MAX_RECENT) list = list.slice(0, MAX_RECENT);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch {}
}

function removeRecentProject(name) {
  const list = getRecentProjects().filter(r => r.name !== name);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch {}
}

function formatRelTime(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ===========================
// USER PREFS (localStorage)
// ===========================
const PREFS_KEY = 'lockit_prefs';

function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({
      colWidths: state.colWidths,
      hiddenCols: [...state.hiddenCols],
    }));
  } catch {}
}

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    if (p.colWidths) state.colWidths = p.colWidths;
    if (p.hiddenCols) p.hiddenCols.forEach(k => state.hiddenCols.add(k));
  } catch {}
}

// ===========================
// INIT
// ===========================
loadPrefs();
renderTable();
setStatus('Ready — load a project or import a CSV to begin');