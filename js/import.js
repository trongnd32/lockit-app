// ── CSV Import ───────────────────────────────────────────────────────────────

let pendingFile = null;

function openImport() {
  const catOptions = [...db.categories].sort()
    .map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');

  showModal(`
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-title">Import CSV</div>
      <div class="modal-sub">First row must be headers. A "KEY" column is required.</div>
      <div class="file-drop" id="drop-zone"
        onclick="document.getElementById('csv-file-input').click()"
        ondragover="event.preventDefault();this.classList.add('drag')"
        ondragleave="this.classList.remove('drag')"
        ondrop="handleFileDrop(event)">
        <div class="drop-icon">📂</div>
        <p>Click to browse or drag & drop a CSV file</p>
        <p id="drop-filename" style="margin-top:6px;color:var(--accent);font-family:var(--mono);font-size:12px"></p>
      </div>
      <input type="file" id="csv-file-input" accept=".csv,text/csv" style="display:none"
        onchange="handleFileSelect(this)">
      <div class="form-group" style="margin-top:16px">
        <label class="form-label">Assign to Category</label>
        <div class="tag-input-wrap">
          <select id="import-cat-select" class="form-input form-select">
            ${catOptions}
            <option value="__new__">+ New category...</option>
          </select>
        </div>
        <input type="text" id="import-cat-new" class="form-input"
          placeholder="New category name" style="margin-top:6px;display:none">
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModalForce()">Cancel</button>
        <button class="btn btn-primary" onclick="doImport()" id="import-btn" disabled>Import</button>
      </div>
    </div>`);

  document.getElementById('import-cat-select').addEventListener('change', function () {
    document.getElementById('import-cat-new').style.display =
      this.value === '__new__' ? 'block' : 'none';
  });
}

function handleFileDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file) _loadFileForImport(file);
}

function handleFileSelect(input) {
  const file = input.files[0];
  if (file) _loadFileForImport(file);
}

function _loadFileForImport(file) {
  pendingFile = file;
  document.getElementById('drop-filename').textContent = file.name;
  document.getElementById('import-btn').disabled = false;
  document.getElementById('drop-zone').querySelector('p').textContent =
    'File loaded. Ready to import.';
}

function doImport() {
  if (!pendingFile) return;
  const catSelect = document.getElementById('import-cat-select').value;
  let category = catSelect === '__new__'
    ? (document.getElementById('import-cat-new').value.trim() || 'general')
    : catSelect;
  category = category.toLowerCase().replace(/\s+/g, '_');

  const reader = new FileReader();
  reader.onload = e => processImport(e.target.result, category);
  reader.readAsText(pendingFile, 'utf-8');
  pendingFile = null;
}

function processImport(text, category) {
  const rows = parseCSV(text);
  if (rows.length < 2) { alert('CSV is empty or has no data rows.'); return; }

  const headers = rows[0].map(h => h.trim());
  const keyIdx  = headers.findIndex(h => h.toUpperCase() === 'KEY');
  if (keyIdx === -1) { alert('No "KEY" column found in CSV.'); return; }

  const notesIdx = headers.findIndex(h => /^notes?$/i.test(h));
  const langCols = headers.reduce((acc, h, i) => {
    if (i === keyIdx || i === notesIdx || !h || /^notes?$/i.test(h)) return acc;
    acc.push({ idx: i, code: h.trim().toLowerCase() });
    return acc;
  }, []);

  db.categories.add(category);

  const conflicts = [];
  const newKeys   = [];
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
      for (const lc of langCols) {
        const nv = langs[lc.code], ov = existing.langs[lc.code] || '';
        if (nv && ov && nv !== ov) conflicts.push({ key, lang: lc.code, old: ov, new: nv });
      }
      if (!conflicts.find(c => c.key === key)) {
        Object.assign(existing.langs, langs);
        if (notes) existing.notes = notes;
        updated++;
      }
    } else {
      newKeys.push({ key, category, langs, notes });
      added++;
    }
  }

  newKeys.forEach(({ key, category, langs, notes }) =>
    db.strings.set(key, { id: key, category, notes, langs }));

  closeModalForce();
  renderTable();

  if (conflicts.length > 0) {
    showConflictDialog(conflicts, () =>
      setStatus(`Imported: +${added} new, ~${updated} merged, ${conflicts.length} conflicts resolved`));
  } else {
    setStatus(`Imported: +${added} new, ~${updated} updated from "${category}"`);
  }
}

// ── Conflict resolution ───────────────────────────────────────────────────────

function showConflictDialog(conflicts, onDone) {
  const byKey = {};
  conflicts.forEach(c => { (byKey[c.key] = byKey[c.key] || []).push(c); });

  const conflictHtml = Object.entries(byKey).map(([key, items]) => `
    <div class="conflict-item">
      <div class="conflict-key">${escHtml(key)}</div>
      ${items.map(c => `
        <div class="conflict-vals">
          <div class="conflict-old"><div class="conflict-lang">${c.lang} — current</div>${escHtml(c.old)}</div>
          <div class="conflict-new"><div class="conflict-lang">${c.lang} — incoming</div>${escHtml(c.new)}</div>
        </div>`).join('')}
    </div>`).join('');

  showModal(`
    <div class="modal modal-lg" onclick="event.stopPropagation()">
      <div class="modal-title">⚠ Translation Conflicts</div>
      <div class="modal-sub">${conflicts.length} conflict(s) in ${Object.keys(byKey).length} string(s).</div>
      <div class="warn-box">Existing translations differ from incoming values.</div>
      <div style="max-height:320px;overflow-y:auto">${conflictHtml}</div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="resolveConflicts('keep')">Keep Current</button>
        <button class="btn btn-primary" onclick="resolveConflicts('replace')">Replace with Incoming</button>
      </div>
    </div>`);

  window._conflictData = conflicts;
  window._conflictDone = onDone;
}

function resolveConflicts(action) {
  if (action === 'replace' && window._conflictData) {
    window._conflictData.forEach(c => {
      if (db.strings.has(c.key)) db.strings.get(c.key).langs[c.lang] = c.new;
    });
  }
  closeModalForce();
  renderTable();
  if (window._conflictDone) window._conflictDone();
}
