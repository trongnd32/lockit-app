// ── User preferences (localStorage) ─────────────────────────────────────────
// Persists column widths and hidden columns between sessions.

const PREFS_KEY = 'lockit_prefs';

function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({
      colWidths:  state.colWidths,
      hiddenCols: [...state.hiddenCols],
    }));
  } catch { /* storage may be unavailable */ }
}

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    if (p.colWidths)  state.colWidths = p.colWidths;
    if (p.hiddenCols) p.hiddenCols.forEach(k => state.hiddenCols.add(k));
  } catch { /* ignore corrupt data */ }
}

// ── Column visibility dropdown ────────────────────────────────────────────────

function getToggleableCols() {
  return [
    { key: 'category', label: 'Category' },
    ...getLangs().map(l => ({ key: `lang_${l}`, label: l.toUpperCase() })),
    { key: 'notes', label: 'Notes' },
  ];
}

function toggleColDropdown() {
  const dropdown = document.getElementById('col-dropdown');
  const btn      = document.getElementById('col-toggle-btn');
  const isOpen   = dropdown.style.display !== 'none';
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
  const cols        = getToggleableCols();
  const hiddenCount = state.hiddenCols.size;

  const items = cols.map(c => {
    const isHidden = state.hiddenCols.has(c.key);
    return `<div class="col-toggle-item ${isHidden ? 'is-hidden' : ''}"
               onclick="toggleColVisibility('${c.key}')">
      <input type="checkbox" ${isHidden ? '' : 'checked'}
        onclick="event.stopPropagation();toggleColVisibility('${c.key}')">
      <label>${c.label}</label>
    </div>`;
  }).join('');

  document.getElementById('col-dropdown').innerHTML = `
    <div class="col-dropdown-header">
      <span>Show / Hide</span>
      <button onclick="resetColVisibility()">Show all</button>
    </div>
    ${items}`;

  const label = document.getElementById('col-toggle-label');
  const btn   = document.getElementById('col-toggle-btn');
  if (label) label.textContent = hiddenCount > 0 ? `Columns (${hiddenCount} hidden)` : 'Columns';
  if (btn)   btn.classList.toggle('active', hiddenCount > 0);
}

function toggleColVisibility(key) {
  if (state.hiddenCols.has(key)) state.hiddenCols.delete(key);
  else state.hiddenCols.add(key);
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

// ── Column resize ─────────────────────────────────────────────────────────────

function handleThClick(e, col) {
  if (e.target.classList.contains('col-resize-handle')) return; // don't sort on drag
  toggleSort(col);
}

function startColResize(e, col) {
  e.preventDefault();
  e.stopPropagation();

  const th      = e.target.closest('th');
  const startX  = e.clientX;
  const startW  = th.offsetWidth;
  const handle  = e.target;
  handle.classList.add('active');

  function onMove(ev) {
    const newW = Math.max(60, startW + ev.clientX - startX);
    state.colWidths[col] = newW;
    th.style.width = newW + 'px';
    savePrefs();
  }

  function onUp() {
    handle.classList.remove('active');
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup',   onUp);
}

// ── Recent projects (localStorage) ───────────────────────────────────────────

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
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { }
}

function removeRecentProject(name) {
  const list = getRecentProjects().filter(r => r.name !== name);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { }
}

function formatRelTime(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
