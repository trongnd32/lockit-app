import { state } from './state.js';
import { savePrefs } from './prefs.js';
import { toggleSort } from './render.js';

export let _resizeState = null;

export function handleThClick(e, col) {
  // Ignore if the click was on the resize handle
  if (e.target.classList.contains('col-resize-handle')) return;
  toggleSort(col);
}

export function startColResize(e, col) {
  e.preventDefault();
  e.stopPropagation();
  const th = e.target.closest('th');
  const startX = e.clientX;
  const startW = th.offsetWidth;
  const handle = e.target;
  handle.classList.add('active');

  _resizeState = { col, startX, startW };

  function onMove(ev) {
    const delta = ev.clientX - startX;
    const newW = Math.max(60, startW + delta);
    state.colWidths[col] = newW;
    // Apply directly to the th for smooth drag (no full re-render)
    th.style.width = newW + 'px';
    savePrefs();
  }

  function onUp() {
    handle.classList.remove('active');
    _resizeState = null;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.handleThClick = handleThClick;
window.startColResize = startColResize;
