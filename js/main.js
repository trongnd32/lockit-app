// ── App bootstrap ────────────────────────────────────────────────────────────
// Runs after all modules are loaded. Sets up global listeners and performs
// the initial render.

// Close column-visibility dropdown when clicking outside it
document.addEventListener('click', e => {
  const wrap = document.getElementById('col-toggle-wrap');
  if (wrap && !wrap.contains(e.target)) {
    const dropdown = document.getElementById('col-dropdown');
    const btn      = document.getElementById('col-toggle-btn');
    if (dropdown) dropdown.style.display = 'none';
    if (btn && !state.hiddenCols.size) btn.classList.remove('active');
  }
});

// Keyboard shortcuts while a row is being edited inline
document.addEventListener('keydown', e => {
  if (!state.editingId) return;
  if (e.key === 'Escape') cancelEdit();
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commitEdit(state.editingId);
});

// Warn before closing the tab if there are unsaved changes
window.addEventListener('beforeunload', e => {
  if (hasUnsavedChanges && db.strings.size > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// Load persisted preferences (column widths, hidden cols) then render
loadPrefs();
renderTable();
setStatus('Ready — load a project or import a CSV to begin');
