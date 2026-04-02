// ── Terminology Tooltip Feature ──────────────────────────────────────────────
// Listens for text selections globally. If selected text matches a terminology,
// shows a floating button nearby. Clicking it opens a small info popup.

(function() {
  let lastMouseX = 0;
  let lastMouseY = 0;
  let currentMatchedTerm = null;

  // Track mouse closely in case they select via keyboard or double-click
  document.addEventListener('mousemove', e => {
    lastMouseX = e.pageX;
    lastMouseY = e.pageY;
  });

  // ── 1. Create Floating Button ──
  const btn = document.createElement('div');
  btn.className = 'term-tooltip-btn';
  btn.style.cssText = `
    position: absolute; display: none; z-index: 9998;
    background: var(--accent); color: var(--bg);
    padding: 6px 12px; border-radius: 4px; font-size: 12px;
    font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    transform: translate(-50%, 25px); transition: opacity 0.1s;
  `;
  btn.textContent = '📖 Terminology Info';
  document.body.appendChild(btn);

  // ── 2. Create Floating Popover ──
  const popover = document.createElement('div');
  popover.className = 'term-tooltip-popover';
  popover.style.cssText = `
    position: absolute; display: none; z-index: 9999;
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    width: 300px; padding: 12px; font-size: 13px; color: var(--text);
  `;
  document.body.appendChild(popover);

  // ── 3. Selection Checking Logic ──
  function getSelectedText() {
    let text = window.getSelection().toString();
    if (!text && document.activeElement) {
      const ae = document.activeElement;
      if ((ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT') && ae.selectionStart !== undefined) {
        text = ae.value.substring(ae.selectionStart, ae.selectionEnd);
      }
    }
    return text.trim();
  }

  function findTerm(text) {
    if (!text || text.length < 2) return null; // Avoid tiny single characters
    const lower = text.toLowerCase();
    for (const t of db.terminologies.values()) {
      if (t.id.toLowerCase() === lower || (t.langs['en'] || '').toLowerCase() === lower) {
        return t;
      }
    }
    return null;
  }

  function handleSelection() {
    // If popover is already open, don't interrupt unless they click elsewhere.
    if (popover.style.display === 'block') return;

    const text = getSelectedText();
    const term = findTerm(text);

    if (term) {
      currentMatchedTerm = term;
      btn.style.left = lastMouseX + 'px';
      btn.style.top = lastMouseY + 'px';
      btn.style.display = 'block';
    } else {
      btn.style.display = 'none';
      popover.style.display = 'none';
    }
  }

  // Trigger check on mouseup or keyboard selection
  document.addEventListener('mouseup', () => setTimeout(handleSelection, 50));
  document.addEventListener('keyup', (e) => {
    if (e.shiftKey && e.key.includes('Arrow')) {
      setTimeout(handleSelection, 50);
    }
  });

  // Hide button on mousedown if clicking away
  document.addEventListener('mousedown', (e) => {
    if (!btn.contains(e.target) && !popover.contains(e.target)) {
      btn.style.display = 'none';
      popover.style.display = 'none';
    }
  });

  // ── 4. Rendering the Popover ──
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault(); // prevent losing selection if in textarea
  });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    btn.style.display = 'none'; // hide button while popover is open
    
    if (!currentMatchedTerm) return;
    const t = currentMatchedTerm;

    let html = `
      <div style="font-weight:600; font-family:var(--mono); color:var(--accent); font-size:14px; margin-bottom:4px; word-break:break-all;">${escHtml(t.id)}</div>
      <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
        <span style="background:var(--border); padding:2px 6px; border-radius:4px; font-size:11px;">${escHtml(t.category)}</span>
      </div>
      <div style="margin-bottom:12px; color:var(--text-muted); font-size:12px; border-left:2px solid var(--accent); padding-left:8px;">
        ${escHtml(t.notes || 'No description provided.')}
      </div>
      <div style="font-weight:600; font-size:11px; margin-bottom:4px; text-transform:uppercase; color:var(--text-muted)">Translations</div>
      <div style="display:grid; grid-template-columns: 40px 1fr; gap:4px 8px; font-size:12px;">
    `;

    // Render defined langs
    const activeLangs = Object.entries(t.langs).filter(([_, val]) => val && val.trim().length > 0);
    if (activeLangs.length === 0) {
      html += `<div style="grid-column:1/-1; color:var(--text-muted)">No translations yet.</div>`;
    } else {
      for (const [l, v] of activeLangs) {
        html += `
          <div style="color:var(--text-muted); font-weight:600; text-align:right;">${escHtml(l.toUpperCase())}</div>
          <div>${escHtml(v)}</div>
        `;
      }
    }
    
    html += `</div>`;
    popover.innerHTML = html;

    // Position popover
    popover.style.display = 'block';
    
    // Bounds checking
    const rect = popover.getBoundingClientRect();
    let left = lastMouseX - (rect.width / 2);
    let top = lastMouseY + 20;

    if (left < 10) left = 10;
    if (left + rect.width > window.innerWidth - 10) left = window.innerWidth - rect.width - 10;
    if (top + rect.height > window.innerHeight - 10) top = lastMouseY - rect.height - 10;
    
    popover.style.left = left + 'px';
    popover.style.top = top + 'px';
  });

})();
