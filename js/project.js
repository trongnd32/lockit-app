import { db } from './store.js';
import { state } from './state.js';
import { closeModalForce, showModal } from './modal.js';
import { formatRelTime, getRecentProjects, pushRecentProject, removeRecentProject } from './recent_projects.js';
import { escHtml, renderTable } from './render.js';
import { setStatus } from './utils.js';

export const PROJECT_VERSION = 1;
export let currentProjectName = null;
export let hasUnsavedChanges = false;

export function markUnsaved() {
  hasUnsavedChanges = true;
  const ind = document.getElementById('save-indicator');
  const lbl = document.getElementById('save-label');
  if (ind) ind.className = 'save-indicator unsaved';
  if (lbl) lbl.textContent = currentProjectName ? `${currentProjectName} *` : 'unsaved *';
}

export function markSaved(name) {
  hasUnsavedChanges = false;
  currentProjectName = name;
  const ind = document.getElementById('save-indicator');
  const lbl = document.getElementById('save-label');
  if (ind) ind.className = 'save-indicator saved';
  if (lbl) lbl.textContent = name;
  // Briefly flash saved, then settle
  setTimeout(() => { if (ind) ind.className = 'save-indicator'; }, 2000);
}

export function serializeDB() {
  return {
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    categories: [...db.categories],
    languages: [...db.languages],
    strings: [...db.strings.values()],
  };
}

export function deserializeDB(data) {
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

export function saveProject() {
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

export function openLoadProject() {
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

export let pendingLoadFile = null;

export function handleLoadDrop(e) {
  e.preventDefault();
  document.getElementById('load-drop-zone').classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file) prepareLoadFile(file);
}

export function handleLoadSelect(input) {
  const file = input.files[0];
  if (file) prepareLoadFile(file);
}

export function prepareLoadFile(file) {
  pendingLoadFile = file;
  document.getElementById('load-filename').textContent = file.name;
  document.getElementById('load-btn').disabled = false;
  document.getElementById('load-drop-zone').querySelector('p').textContent = 'File ready. Click Load to continue.';
}

export function doLoadProject() {
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
export const _origSet = db.strings.set.bind(db.strings);
db.strings.set = function(k, v) { const r = _origSet(k, v); markUnsaved(); return r; };
export const _origDel = db.strings.delete.bind(db.strings);
db.strings.delete = function(k) { const r = _origDel(k); markUnsaved(); return r; };
export const _origCatAdd = db.categories.add.bind(db.categories);
db.categories.add = function(v) { const r = _origCatAdd(v); markUnsaved(); return r; };

// Warn on tab close if unsaved
window.addEventListener('beforeunload', e => {
  if (hasUnsavedChanges && db.strings.size > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});

window.markUnsaved = markUnsaved;
window.markSaved = markSaved;
window.serializeDB = serializeDB;
window.deserializeDB = deserializeDB;
window.saveProject = saveProject;
window.openLoadProject = openLoadProject;
window.handleLoadDrop = handleLoadDrop;
window.handleLoadSelect = handleLoadSelect;
window.prepareLoadFile = prepareLoadFile;
window.doLoadProject = doLoadProject;
