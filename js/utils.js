export function parseCSV(text) {
  const lines = [];
  let cur = '', inQ = false;
  const rows = [];
  let cells = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQ && text[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      cells.push(cur); cur = '';
    } else if ((c === '\n' || c === '\r') && !inQ) {
      if (c === '\r' && text[i+1] === '\n') i++;
      cells.push(cur); cur = '';
      if (cells.some(x => x !== '') || rows.length === 0) rows.push(cells);
      cells = [];
    } else cur += c;
  }
  cells.push(cur);
  if (cells.some(x => x !== '')) rows.push(cells);
  return rows;
}

export function toCSV(rows) {
  return rows.map(r => r.map(c => {
    const s = String(c ?? '');
    return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(',')).join('\n');
}

export function setStatus(msg) {
  document.getElementById('footer-status').textContent = msg;
}

window.parseCSV = parseCSV;
window.toCSV = toCSV;
window.setStatus = setStatus;
