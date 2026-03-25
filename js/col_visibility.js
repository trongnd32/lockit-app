import { state } from './state.js';
import { savePrefs } from './prefs.js';
import { getLangs, renderTable } from './render.js';

export function getToggleableCols() {
  // All columns except id and _actions
  const langs = getLangs();
  return [
    { key: 'category', label: 'Category' },
    ...langs.map(l => ({ key: `lang_${l}`, label: l.toUpperCase() })),
    { key: 'notes', label: 'Notes' },
  ];
}

export function toggleColDropdown() {
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

export function renderColDropdown() {
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

export function toggleColVisibility(key) {
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

export function resetColVisibility() {
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

window.getToggleableCols = getToggleableCols;
window.toggleColDropdown = toggleColDropdown;
window.renderColDropdown = renderColDropdown;
window.toggleColVisibility = toggleColVisibility;
window.resetColVisibility = resetColVisibility;
