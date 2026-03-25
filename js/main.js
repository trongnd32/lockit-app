import { loadPrefs } from './prefs.js';
import { renderTable } from './render.js';
import { setStatus } from './utils.js';

loadPrefs();
renderTable();
setStatus('Ready — load a project or import a CSV to begin');
