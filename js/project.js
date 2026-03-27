// ── Project save / load ──────────────────────────────────────────────────────

const PROJECT_VERSION = 1;
let currentProjectName = null;
let hasUnsavedChanges  = false;
let pendingLoadFile    = null;

// ── UI state helpers ──

function updateProjectNameUI() {
  const el  = document.getElementById('project-name-display');
  const ind = document.getElementById('save-indicator');
  if (!el) return;

  if (!currentProjectName) {
    el.textContent = 'no project';
    el.className   = 'project-name-display no-project';
  } else if (hasUnsavedChanges) {
    el.textContent = currentProjectName;
    el.className   = 'project-name-display unsaved';
  } else {
    el.textContent = currentProjectName;
    el.className   = 'project-name-display';
  }

  if (ind) ind.className = 'save-indicator' +
    (hasUnsavedChanges ? ' unsaved' : currentProjectName ? ' saved' : '');
}

function markUnsaved() {
  hasUnsavedChanges = true;
  updateProjectNameUI();
}

function markSaved(name) {
  hasUnsavedChanges  = false;
  currentProjectName = name;
  updateProjectNameUI();
  setTimeout(updateProjectNameUI, 2000);
}

// ── Rename ──

function startRenameProject() {
  const disp = document.getElementById('project-name-display');
  const inp  = document.getElementById('project-name-input');
  inp.value         = currentProjectName || '';
  disp.style.display = 'none';
  inp.style.display  = 'block';
  inp.focus();
  inp.select();
}

function commitRenameProject() {
  const inp  = document.getElementById('project-name-input');
  const disp = document.getElementById('project-name-display');
  const name = inp.value.trim();
  inp.style.display  = 'none';
  disp.style.display = '';
  if (name && name !== currentProjectName) {
    currentProjectName = name;
    markUnsaved();
    setStatus(`Project renamed to "${name}" — save to persist`);
  }
  updateProjectNameUI();
}

function cancelRenameProject() {
  document.getElementById('project-name-input').style.display = 'none';
  document.getElementById('project-name-display').style.display = '';
}

// ── Serialize / Deserialize ──

function serializeDB() {
  return {
    version:     PROJECT_VERSION,
    projectName: currentProjectName,
    savedAt:     new Date().toISOString(),
    categories:  [...db.categories],
    languages:   [...db.languages],
    strings:     [...db.strings.values()],
  };
}

function deserializeDB(data) {
  if (!data || !data.strings) throw new Error('Invalid project file.');

  // Use the raw pre-intercept methods so we don't fire markUnsaved() thousands
  // of times during a bulk load (one call at the end is enough).
  db.strings.clear();
  db.categories.clear();
  db.languages.clear();

  (data.categories || []).forEach(c => _origCatAdd(c));
  (data.languages  || []).forEach(l => db.languages.add(l));
  data.strings.forEach(s => _origSet(s.id, {
    id:       s.id,
    category: s.category || 'general',
    notes:    s.notes    || '',
    langs:    s.langs    || {},
  }));
}

// ── Save ──

function saveProject() {
  if (db.strings.size === 0) { alert('Nothing to save — database is empty.'); return; }

  if (!currentProjectName) {
    // First save: prompt for a name
    showModal(`
      <div class="modal modal-sm" onclick="event.stopPropagation()">
        <div class="modal-title">Name Your Project</div>
        <div class="modal-sub">The file will be saved as
          <code style="font-family:var(--mono);color:var(--accent)">name.lockit.json</code>.
        </div>
        <div class="form-group" style="margin-top:12px">
          <label class="form-label">Project Name</label>
          <input type="text" class="form-input" id="new-project-name"
            placeholder="e.g. My Game Translations">
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" onclick="closeModalForce()">Cancel</button>
          <button class="btn btn-primary" onclick="doSaveWithName()">Save</button>
        </div>
      </div>`);
    setTimeout(() => document.getElementById('new-project-name')?.focus(), 50);
    return;
  }
  _doSaveProject(currentProjectName);
}

function doSaveWithName() {
  const name = document.getElementById('new-project-name')?.value.trim();
  if (!name) return;
  closeModalForce();
  _doSaveProject(name);
}

function _doSaveProject(name) {
  const json = JSON.stringify({ ...serializeDB(), projectName: name }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href:     url,
    download: `${toSnakeCase(name)}.lockit.json`,
  });
  a.click();
  URL.revokeObjectURL(url);
  markSaved(name);
  pushRecentProject(name);
  setStatus(`Saved: ${a.download}`);
}

// ── Load ──

async function openLoadProjectModal() {
  const warnHtml = hasUnsavedChanges
    ? `<div class="warn-box">⚠ You have unsaved changes. Loading will replace the current database.</div>`
    : '';

  const recent = getRecentProjects();
  const recentHtml = recent.length ? `
    <div style="margin-bottom:16px">
      <div style="font-family:var(--mono);font-size:10px;font-weight:600;text-transform:uppercase;
                  letter-spacing:0.8px;color:var(--text-muted);margin-bottom:8px">Recent Projects</div>
      <div class="recent-list">
        ${recent.map(r => `
          <div class="recent-item" title="${escHtml(r.name)}.lockit.json">
            <span style="font-size:14px">📄</span>
            <span class="recent-item-name">${escHtml(r.name)}</span>
            <span class="recent-item-time">${formatRelTime(r.loadedAt)}</span>
            <span style="font-size:11px;color:var(--text-muted);cursor:pointer;padding:2px 4px"
              title="Remove from recent"
              onclick="event.stopPropagation();removeRecentProject('${escHtml(r.name)}');openLoadProjectModal()">✕</span>
          </div>`).join('')}
      </div>
    </div>` : '';

  showModal(`
    <div class="modal" onclick="event.stopPropagation()" style="width:520px">
      <div class="modal-title">Load Project</div>
      <div class="modal-sub">Choose a Local file or a Remote GitHub project.</div>
      ${warnHtml}
      ${recentHtml}

      <div style="display:flex; gap:16px; margin-top:20px;">
        <!-- Local -->
        <div style="flex:1;">
          <div style="font-weight:600; font-size:12px; margin-bottom:8px;">Local File</div>
          <div class="file-drop" id="load-drop-zone"
            onclick="document.getElementById('json-file-input').click()"
            ondragover="event.preventDefault();this.classList.add('drag')"
            ondragleave="this.classList.remove('drag')"
            ondrop="handleLoadDrop(event)" style="padding:20px 10px; min-height:80px;">
            <div class="drop-icon" style="font-size:24px;">📁</div>
            <p>Click or drag .lockit.json</p>
            <p id="load-filename" style="margin-top:6px;color:var(--accent);font-family:var(--mono);font-size:11px"></p>
          </div>
          <button class="btn btn-primary" id="load-btn" disabled onclick="doLoadProject()" style="width:100%; margin-top:8px;">Load Local File</button>
        </div>

        <!-- Remote -->
        <div style="flex:1;">
          <div style="font-weight:600; font-size:12px; margin-bottom:8px;">GitHub Cloud</div>
          <div id="github-list-container" style="border:1px solid var(--border); border-radius:6px; background:var(--bg); height:124px; overflow-y:auto; padding:8px;">
            <div style="color:var(--text-muted); font-size:12px; text-align:center; margin-top:30px;">Loading remote files...</div>
          </div>
        </div>
      </div>

      <input type="file" id="json-file-input" accept=".json,application/json"
        style="display:none" onchange="handleLoadSelect(this)">
        
      <div class="modal-actions" style="margin-top:20px;">
        <button class="btn btn-ghost" onclick="closeModalForce()">Cancel</button>
      </div>
    </div>
  `);

  // Fetch GitHub files
  const ghContainer = document.getElementById('github-list-container');
  try {
    if (!getSetting('github_token')) {
      ghContainer.innerHTML = '<div style="color:var(--text-muted); font-size:12px; text-align:center; margin-top:30px;">GitHub is not configured.<br><br><a href="#" onclick="closeModalForce(); openSettings(); return false;" style="color:var(--accent)">⚙ Open Settings</a></div>';
      return;
    }
    
    const files = await fetchListFromGithub();
    if (files.length === 0) {
      ghContainer.innerHTML = '<div style="color:var(--text-muted); font-size:12px; text-align:center; margin-top:30px;">No .json files found in remote folder.</div>';
    } else {
      ghContainer.innerHTML = files.map(f => `
        <div style="padding:6px; border-bottom:1px solid var(--border); cursor:pointer; font-size:12px; border-radius:4px; margin-bottom:2px;" 
             class="remote-file-item"
             onmouseover="this.style.background='var(--border)'" 
             onmouseout="this.style.background='transparent'"
             onclick="doLoadRemoteProject('${f.name}')">
          ☁ ${escHtml(f.name)}
        </div>
      `).join('');
    }
  } catch (err) {
    ghContainer.innerHTML = `<div style="color:var(--accent2); font-size:12px; text-align:center; margin-top:30px;">Error: ${escHtml(err.message)}</div>`;
  }
}

function handleLoadDrop(e) {
  e.preventDefault();
  document.getElementById('load-drop-zone').classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file) _prepareLoadFile(file);
}

function handleLoadSelect(input) {
  const file = input.files[0];
  if (file) _prepareLoadFile(file);
}

function _prepareLoadFile(file) {
  pendingLoadFile = file;
  document.getElementById('load-filename').textContent = file.name;
  document.getElementById('load-btn').disabled = false;
  document.getElementById('load-drop-zone').querySelector('p').textContent =
    'File ready. Click Load to continue.';
}

function doLoadProject() {
  if (!pendingLoadFile) return;

  const loadBtn = document.getElementById('load-btn');
  if (loadBtn) { loadBtn.disabled = true; loadBtn.textContent = 'Loading…'; }
  setStatus('Loading project…');

  const file = pendingLoadFile;
  pendingLoadFile = null;

  // Parse JSON in a Worker so the main thread stays responsive for large files
  const workerSrc = `
    self.onmessage = function(e) {
      try { self.postMessage({ ok: true,  data: JSON.parse(e.data) }); }
      catch(err) { self.postMessage({ ok: false, error: err.message }); }
    };`;
  const workerBlob = new Blob([workerSrc], { type: 'application/javascript' });
  const workerUrl  = URL.createObjectURL(workerBlob);
  const worker     = new Worker(workerUrl);

  const reader     = new FileReader();
  reader.onload    = ev => worker.postMessage(ev.target.result);

  worker.onmessage = ev => {
    worker.terminate();
    URL.revokeObjectURL(workerUrl);
    const { ok, data, error } = ev.data;
    if (!ok) { alert(`Failed to load: ${error}`); return; }
    try {
      const fname = data.projectName ||
        file.name.replace(/\.lockit\.json$/i, '').replace(/\.json$/i, '');
      deserializeDB(data);
      state.activeCategory = '__ALL__';
      state.filters        = {};
      closeModalForce();
      renderTable();
      markSaved(fname);
      pushRecentProject(fname);
      setStatus(`Loaded: ${fname} — ${db.strings.size} strings, ${db.languages.size} languages`);
    } catch (err) {
      alert(`Failed to apply project: ${err.message}`);
    }
  };

  worker.onerror = err => {
    worker.terminate();
    URL.revokeObjectURL(workerUrl);
    alert(`Worker error: ${err.message}`);
  };

  reader.readAsText(file, 'utf-8');
}

// ── Remote GitHub API Load / Save ──

async function doLoadRemoteProject(filename) {
  try {
    setStatus(`Downloading ${filename} from GitHub...`);
    const jsonString = await loadFileFromGithub(filename);
    const data = JSON.parse(jsonString);
    
    deserializeDB(data);
    const fname = data.projectName || filename.replace(/\.lockit\.json$/i, '').replace(/\.json$/i, '');
    state.activeCategory = '__ALL__';
    state.filters = {};
    
    closeModalForce();
    renderTable();
    markSaved(fname);
    pushRecentProject(fname);
    setStatus(`Loaded remote: ${fname} — ${db.strings.size} strings`);
  } catch (err) {
    alert(`Failed to load remote project: ${err.message}`);
    setStatus('');
  }
}

async function saveProjectRemote() {
  if (db.strings.size === 0) { alert('Nothing to save — database is empty.'); return; }
  
  if (!getSetting('github_token')) {
    alert('GitHub Cloud Sync is not configured. Please set your token and repository inside Settings first.');
    openSettings();
    return;
  }

  if (!currentProjectName) {
    // If no project name yet, prompt for it locally first to establish a filename
    alert('Please save locally once or define a project name before pushing to remote.');
    saveProject(); 
    return;
  }
  
  try {
    setStatus('Pushing to GitHub...');
    const name = currentProjectName;
    const filename = `${toSnakeCase(name)}.lockit.json`;
    const json = JSON.stringify({ ...serializeDB(), projectName: name }, null, 2);
    
    await saveToGithub(filename, json);
    markSaved(name);
    setStatus(`☁ Successfully pushed to GitHub: ${filename}`);
  } catch (err) {
    alert(`Failed to push to GitHub: ${err.message}`);
    setStatus('');
  }
}
