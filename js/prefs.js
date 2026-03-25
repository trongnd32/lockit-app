import { state } from './state.js';

export const PREFS_KEY = 'lockit_prefs';

export function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({
      colWidths: state.colWidths,
      hiddenCols: [...state.hiddenCols],
    }));
  } catch {}
}

export function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    if (p.colWidths) state.colWidths = p.colWidths;
    if (p.hiddenCols) p.hiddenCols.forEach(k => state.hiddenCols.add(k));
  } catch {}
}

window.savePrefs = savePrefs;
window.loadPrefs = loadPrefs;
