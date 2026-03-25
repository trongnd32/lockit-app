export const RECENT_KEY = 'lockit_recent_projects';
export const MAX_RECENT = 8;

export function getRecentProjects() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
  catch { return []; }
}

export function pushRecentProject(name) {
  let list = getRecentProjects().filter(r => r.name !== name);
  list.unshift({ name, loadedAt: Date.now() });
  if (list.length > MAX_RECENT) list = list.slice(0, MAX_RECENT);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch {}
}

export function removeRecentProject(name) {
  const list = getRecentProjects().filter(r => r.name !== name);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch {}
}

export function formatRelTime(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

window.getRecentProjects = getRecentProjects;
window.pushRecentProject = pushRecentProject;
window.removeRecentProject = removeRecentProject;
window.formatRelTime = formatRelTime;
