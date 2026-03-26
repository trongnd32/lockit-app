// ── Utilities ────────────────────────────────────────────────────────────────

/** Parse a CSV string into a 2-D array of strings. Handles quoted fields,
 *  escaped double-quotes, and both \r\n and \n line endings. */
function parseCSV(text) {
  let cur = '', inQ = false;
  const rows = [];
  let cells = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQ && text[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      cells.push(cur); cur = '';
    } else if ((c === '\n' || c === '\r') && !inQ) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      cells.push(cur); cur = '';
      if (cells.some(x => x !== '') || rows.length === 0) rows.push(cells);
      cells = [];
    } else {
      cur += c;
    }
  }
  cells.push(cur);
  if (cells.some(x => x !== '')) rows.push(cells);
  return rows;
}

/** Serialize a 2-D array into a CSV string. Quotes fields that contain
 *  commas, double-quotes, or newlines. */
function toCSV(rows) {
  return rows.map(r => r.map(c => {
    const s = String(c ?? '');
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
}

/** Escape a string for safe insertion into HTML. */
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Returns a debounced version of fn that fires after ms milliseconds of
 *  silence. Each new call resets the timer. */
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/** Write a message to the status bar in the page footer. */
function setStatus(msg) {
  document.getElementById('footer-status').textContent = msg;
}

/** Convert a project name to a safe snake_case filename stem. */
function toSnakeCase(s) {
  return s.trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'project';
}
