import { db } from './store.js';
import { state } from './state.js';
import { currentProjectName } from './project.js';
import { closeModalForce, showModal } from './modal.js';
import { getLangs } from './render.js';
import { setStatus, toCSV } from './utils.js';

export function openExportDialog() {
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

export function renderExportDialog() {
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

export let _dragSrcIdx = null;

export function exportDragStart(e, idx) {
  _dragSrcIdx = idx;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

export function exportDragOver(e, idx) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (idx !== _dragSrcIdx) e.currentTarget.classList.add('drag-over');
}

export function exportDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

export function exportDrop(e, idx) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (_dragSrcIdx === null || _dragSrcIdx === idx) return;
  const cols = window._exportCols;
  const [moved] = cols.splice(_dragSrcIdx, 1);
  cols.splice(idx, 0, moved);
  _dragSrcIdx = null;
  renderExportDialog();
}

export function exportDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  _dragSrcIdx = null;
  // clean up any leftover drag-over classes
  document.querySelectorAll('.col-picker-item').forEach(el => el.classList.remove('drag-over'));
}

export function exportToggleCol(idx, val) {
  window._exportCols[idx].enabled = val;
  // Update count label without full re-render (avoids losing drag state)
  const cols = window._exportCols;
  const enabledCount = cols.filter(c => c.enabled).length;
  const countEl = document.querySelector('.picker-actions-row span');
  if (countEl) countEl.textContent = `${enabledCount} of ${cols.length} columns`;
}

export function exportSelectAll(val) {
  window._exportCols.forEach(c => { if (c.id !== 'KEY') c.enabled = val; });
  renderExportDialog();
}

export function doExportCSV() {
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

window.openExportDialog = openExportDialog;
window.renderExportDialog = renderExportDialog;
window.exportDragStart = exportDragStart;
window.exportDragOver = exportDragOver;
window.exportDragLeave = exportDragLeave;
window.exportDrop = exportDrop;
window.exportDragEnd = exportDragEnd;
window.exportToggleCol = exportToggleCol;
window.exportSelectAll = exportSelectAll;
window.doExportCSV = doExportCSV;
