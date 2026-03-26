// ── Render ───────────────────────────────────────────────────────────────────
// Responsible for building and updating the DOM: the table header, filter row,
// virtual-scroll body, sidebar category list, and stats counters.

// ── Helpers ──

function getLangs() {
  return [...db.languages].sort();
}

/** Returns the filtered + optionally sorted array of string objects. */
function getVisibleStrings() {
  const gs = state.globalSearch.toLowerCase().trim();

  const filtered = [...db.strings.values()].filter(s => {
    if (state.activeCategory !== '__ALL__' && s.category !== state.activeCategory) return false;

    for (const [col, val] of Object.entries(state.filters)) {
      if (!val) continue;
      const v = val.toLowerCase();
      if (col === 'id'       && !s.id.toLowerCase().includes(v)) return false;
      if (col === 'category' && !s.category.toLowerCase().includes(v)) return false;
      if (col === 'notes'    && !(s.notes || '').toLowerCase().includes(v)) return false;
      if (col.startsWith('lang_')) {
        const lang = col.slice(5);
        if (!(s.langs[lang] || '').toLowerCase().includes(v)) return false;
      }
    }

    if (gs) {
      const hay = [s.id, s.category, s.notes || '', ...Object.values(s.langs)].join(' ').toLowerCase();
      if (!hay.includes(gs)) return false;
    }
    return true;
  });

  if (!state.sortCol) return filtered; // preserve insertion order

  return filtered.sort((a, b) => {
    const dir = state.sortDir === 'asc' ? 1 : -1;
    const col = state.sortCol;
    let av, bv;
    if (col === 'id')               { av = a.id;          bv = b.id; }
    else if (col === 'category')    { av = a.category;    bv = b.category; }
    else if (col.startsWith('lang_')) { const l = col.slice(5); av = a.langs[l] || ''; bv = b.langs[l] || ''; }
    else { av = ''; bv = ''; }
    return av < bv ? -dir : av > bv ? dir : 0;
  });
}

/** Returns the visible column definitions, respecting hiddenCols. */
function buildHeaders() {
  const langs = getLangs();
  const all = [
    { key: 'id',       label: 'String ID' },
    { key: 'category', label: 'Category'  },
    ...langs.map(l => ({ key: `lang_${l}`, label: l.toUpperCase() })),
    { key: 'notes',    label: 'Notes'     },
    { key: '_actions', label: ''          },
  ];
  return all.filter(c => c.key === 'id' || c.key === '_actions' || !state.hiddenCols.has(c.key));
}

// ── Full render ──
// Rebuilds the header row, filter row, and tbody.
// Call this when the column set, sort order, or active category changes.

function renderTable() {
  state.globalSearch = document.getElementById('global-search').value;
  const cols = buildHeaders();

  // Header row
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
    return `<th class="${cls}" style="${wStyle}" data-col="${c.key}"
              onclick="handleThClick(event,'${c.key}')">${c.label
            }<span class="sort-icon"></span
            ><div class="col-resize-handle" data-resize="${c.key}"
                  onmousedown="startColResize(event,'${c.key}')"></div></th>`;
  }).join('');

  // Filter row — listeners attached via JS, NOT inline oninput, so the input
  // element is never re-created while typing (avoids focus loss).
  const fr = document.getElementById('filter-row');
  fr.innerHTML = cols.map(c => {
    if (c.key === '_actions') return `<th></th>`;
    const val = state.filters[c.key] || '';
    return `<th><input data-fcol="${c.key}" placeholder="filter…" value="${escHtml(val)}"></th>`;
  }).join('');

  fr.querySelectorAll('input[data-fcol]').forEach(inp => {
    inp.addEventListener('input', () => {
      state.filters[inp.dataset.fcol] = inp.value;
      _debouncedRenderBody();
    });
  });

  renderBody(cols);
  updateStats();
  renderSidebar();

  // Keep the Columns button label in sync after structural changes
  const dropdown = document.getElementById('col-dropdown');
  if (dropdown && dropdown.style.display !== 'none') renderColDropdown();
  else {
    const label = document.getElementById('col-toggle-label');
    const btn   = document.getElementById('col-toggle-btn');
    if (label) label.textContent = state.hiddenCols.size ? `Columns (${state.hiddenCols.size} hidden)` : 'Columns';
    if (btn)   btn.classList.toggle('active', state.hiddenCols.size > 0);
  }
}

// ── Virtual scroll ───────────────────────────────────────────────────────────
// Instead of injecting one <tr> per string into the DOM (slow for 5 000+
// rows), we maintain VS.rows and only render the slice visible in the
// viewport, with spacer rows above/below to keep the scrollbar accurate.

const VS = {
  ROW_H:    36,   // estimated row height in px — tune if rows are taller
  OVERSCAN: 8,    // extra rows rendered above and below the viewport
  rows:     [],   // current filtered+sorted dataset
  startIdx: 0,
  endIdx:   0,
  cols:     [],
  _raf:     null,
};

function renderBody(cols) {
  cols = cols || buildHeaders();
  VS.cols = cols;
  VS.rows = getVisibleStrings();

  const tbody   = document.getElementById('table-body');
  const isEmpty = VS.rows.length === 0;

  document.getElementById('empty-state').style.display =
    isEmpty && db.strings.size === 0 ? 'flex' : 'none';
  document.querySelector('.table-wrap table').style.display =
    isEmpty && db.strings.size === 0 ? 'none' : '';
  document.getElementById('row-count').textContent =
    `${VS.rows.length} / ${db.strings.size} strings`;

  if (isEmpty) { tbody.innerHTML = ''; return; }

  // Attach the scroll listener once
  const wrap = document.querySelector('.table-wrap');
  if (!wrap._vsAttached) {
    wrap._vsAttached = true;
    wrap.addEventListener('scroll', () => {
      if (VS._raf) return;
      VS._raf = requestAnimationFrame(() => { VS._raf = null; _vsPaint(); });
    }, { passive: true });
  }

  _vsPaint(true); // force full repaint on new data
}

function _vsPaint(reset) {
  const wrap  = document.querySelector('.table-wrap');
  const tbody = document.getElementById('table-body');
  if (!wrap || !tbody) return;

  const scrollTop  = wrap.scrollTop;
  const viewH      = wrap.clientHeight;
  const totalRows  = VS.rows.length;
  const rowH       = VS.ROW_H;

  const start = Math.max(0, Math.floor(scrollTop / rowH) - VS.OVERSCAN);
  const end   = Math.min(totalRows, Math.ceil((scrollTop + viewH) / rowH) + VS.OVERSCAN);

  if (!reset && start === VS.startIdx && end === VS.endIdx) return;
  VS.startIdx = start;
  VS.endIdx   = end;

  const topPad    = start * rowH;
  const bottomPad = Math.max(0, (totalRows - end) * rowH);
  const colCount  = VS.cols.length;

  const parts = [
    `<tr style="height:${topPad}px;border:none"><td colspan="${colCount}" style="padding:0;border:none"></td></tr>`,
  ];
  for (let i = start; i < end; i++) {
    const s = VS.rows[i];
    parts.push(state.editingId === s.id ? buildEditRow(s, VS.cols) : buildViewRow(s, VS.cols));
  }
  parts.push(
    `<tr style="height:${bottomPad}px;border:none"><td colspan="${colCount}" style="padding:0;border:none"></td></tr>`,
  );
  tbody.innerHTML = parts.join('');
}

/** Repaint the current viewport without re-filtering. Use after inline-edit
 *  state changes (startEdit / cancelEdit). */
function repaintBody() { _vsPaint(true); }

// ── Row builders ──

function buildViewRow(s, cols) {
  const cells = cols.map(c => {
    if (c.key === 'id')       return `<td class="key-cell">${escHtml(s.id)}</td>`;
    if (c.key === 'category') return `<td><span class="cat-badge">${escHtml(s.category)}</span></td>`;
    if (c.key === '_actions') return `<td><div class="actions-cell">
      <button class="btn btn-ghost btn-sm" onclick='startEdit(${JSON.stringify(s.id)})'>Edit</button>
      <button class="btn btn-danger btn-sm" onclick='deleteString(${JSON.stringify(s.id)})'>Del</button>
    </div></td>`;
    if (c.key === 'notes') return `<td style="color:var(--text-muted);font-size:12px">${escHtml(s.notes || '')}</td>`;
    if (c.key.startsWith('lang_')) {
      const lang = c.key.slice(5);
      const val  = s.langs[lang] || '';
      return `<td class="lang-cell ${val ? '' : 'empty'}">${val ? escHtml(val) : '—'}</td>`;
    }
    return '<td></td>';
  }).join('');
  return `<tr data-id="${escHtml(s.id)}">${cells}</tr>`;
}

function buildEditRow(s, cols) {
  const catOptions = [...db.categories].sort().map(c =>
    `<option value="${escHtml(c)}" ${s.category === c ? 'selected' : ''}>${escHtml(c)}</option>`
  ).join('');

  const cells = cols.map(c => {
    if (c.key === 'id')       return `<td><input class="inline-edit-input mono" id="ie-id" value="${escHtml(s.id)}"></td>`;
    if (c.key === 'category') return `<td><select class="inline-edit-select" id="ie-cat">${catOptions}</select></td>`;
    if (c.key === '_actions') return `<td><div class="actions-cell" style="flex-direction:column;align-items:stretch;gap:4px;min-width:90px">
      <div style="display:flex;gap:4px">
        <button class="btn btn-primary btn-sm" onclick='commitEdit(${JSON.stringify(s.id)})'>Save</button>
        <button class="btn btn-ghost btn-sm" onclick='cancelEdit()'>Cancel</button>
      </div>
      <button class="btn btn-ai" onclick='openAiTrans(${JSON.stringify(s.id)})'>✦ AI Trans</button>
    </div></td>`;
    if (c.key === 'notes') return `<td><textarea class="inline-edit-textarea" id="ie-notes" rows="2" placeholder="Notes…">${escHtml(s.notes || '')}</textarea></td>`;
    if (c.key.startsWith('lang_')) {
      const lang = c.key.slice(5);
      const val  = s.langs[lang] || '';
      return `<td><textarea class="inline-edit-textarea" id="ie-lang-${lang}" rows="3" placeholder="${lang}…">${escHtml(val)}</textarea></td>`;
    }
    return '<td></td>';
  }).join('');
  return `<tr class="editing" data-id="${escHtml(s.id)}">${cells}</tr>`;
}

// ── Sidebar + stats ──

function renderSidebar() {
  const catList  = document.getElementById('cat-list');
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

function updateStats() {
  document.getElementById('stat-strings').textContent = db.strings.size;
  document.getElementById('stat-langs').textContent   = db.languages.size;
  document.getElementById('stat-cats').textContent    = db.categories.size;
}

// ── Sort / filter ──

function toggleSort(col) {
  if (state.sortCol === col) {
    if (state.sortDir === 'asc') { state.sortDir = 'desc'; }
    else { state.sortCol = null; state.sortDir = 'asc'; } // 3rd click → clear
  } else {
    state.sortCol = col; state.sortDir = 'asc';
  }
  renderTable();
}

function setCategory(cat) {
  state.activeCategory = cat;
  state.filters = {};
  state.editingId = null;
  renderTable();
}

function onGlobalSearch() {
  state.globalSearch = document.getElementById('global-search').value;
  _debouncedRenderBody();
}

// Debounced body-only refresh — keeps filter inputs focused while typing
const _debouncedRenderBody = debounce(() => {
  renderBody();
  updateStats();
  renderSidebar();
}, 80);
