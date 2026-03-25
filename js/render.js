import { db } from './store.js';
import { state } from './state.js';
import { deleteString } from './add_string.js';
import { handleThClick, startColResize } from './col_resize.js';
import { renderColDropdown } from './col_visibility.js';
import { cancelEdit, commitEdit, startEdit } from './row_edit.js';

export function getLangs() {
  return [...db.languages].sort();
}

export function getVisibleStrings() {
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

export function buildHeaders() {
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
export function renderTable() {
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
export function renderBody(cols) {
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

export function buildViewRow(s, cols) {
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

export function buildEditRow(s, cols) {
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

export function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function toggleSort(col) {
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

export function setFilter(col, val) {
  state.filters[col] = val;
  renderBody();
  updateStats();
  renderSidebar();
}

export function onGlobalSearch() {
  state.globalSearch = document.getElementById('global-search').value;
  renderBody();
  updateStats();
  renderSidebar();
}

export function renderSidebar() {
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

export function setCategory(cat) {
  state.activeCategory = cat;
  state.filters = {};
  state.editingId = null;
  renderTable();
}

export function updateStats() {
  document.getElementById('stat-strings').textContent = db.strings.size;
  document.getElementById('stat-langs').textContent = db.languages.size;
  document.getElementById('stat-cats').textContent = db.categories.size;
}

window.getLangs = getLangs;
window.getVisibleStrings = getVisibleStrings;
window.buildHeaders = buildHeaders;
window.renderTable = renderTable;
window.renderBody = renderBody;
window.buildViewRow = buildViewRow;
window.buildEditRow = buildEditRow;
window.escHtml = escHtml;
window.toggleSort = toggleSort;
window.setFilter = setFilter;
window.onGlobalSearch = onGlobalSearch;
window.renderSidebar = renderSidebar;
window.setCategory = setCategory;
window.updateStats = updateStats;
