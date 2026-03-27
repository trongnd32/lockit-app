// ── GitHub Remote Sync API ──────────────────────────────────────────────────

function btoaUTF8(str) {
  const bytes = new TextEncoder().encode(str);
  const binString = Array.from(bytes, (byte) =>
    String.fromCodePoint(byte),
  ).join("");
  return btoa(binString);
}


function atobUTF8(b64) {
  const binString = atob(b64);
  const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0));
  return new TextDecoder().decode(bytes);
}

async function createGithubRequest(endpoint, method = 'GET', body = null) {
  const token = getSetting('github_token', '');
  if (!token) throw new Error("GitHub Personal Access Token is not set in Settings.");
  
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `Bearer ${token}`
  };

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`https://api.github.com${endpoint}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API Status ${res.status}`);
  }
  return res.json();
}

/** Lists all JSON projects in the remote folder */
async function fetchListFromGithub() {
  const repo = getSetting('github_repo', '');
  const branch = getSetting('github_branch', 'main');
  let folder = getSetting('github_folder', 'Remote project/');
  
  if (folder.endsWith('/')) folder = folder.slice(0, -1);
  if (folder.startsWith('/')) folder = folder.substring(1);

  if (!repo) throw new Error("GitHub Repository is not configured.");

  const endpoint = `/repos/${repo}/contents/${folder}?ref=${branch}`;
  try {
    const files = await createGithubRequest(endpoint);
    if (!Array.isArray(files)) return [];
    return files.filter(f => f.name.endsWith('.json') && f.type === 'file');
  } catch (err) {
    if (err.message.includes('Not Found')) return []; // Folder literally doesn't exist yet
    throw err;
  }
}

/** Loads a specific file JSON string from GitHub */
async function loadFileFromGithub(filename) {
  const repo = getSetting('github_repo', '');
  const branch = getSetting('github_branch', 'main');
  let folder = getSetting('github_folder', 'Remote project/');
  if (folder && !folder.endsWith('/')) folder += '/';
  if (folder.startsWith('/')) folder = folder.substring(1);
  
  const filepath = `${folder}${filename}`.replace(/\/\//g, '/');
  const endpoint = `/repos/${repo}/contents/${filepath}?ref=${branch}`;
  
  const fileData = await createGithubRequest(endpoint);
  if (fileData.encoding === 'base64') {
    return atobUTF8(fileData.content.replace(/\n/g, ''));
  }
  throw new Error("Unknown encoding format from GitHub.");
}

/** Saves JSON to GitHub (creating or updating existing file) */
async function saveToGithub(filename, jsonString) {
  const repo = getSetting('github_repo', '');
  const branch = getSetting('github_branch', 'main');
  let folder = getSetting('github_folder', 'Remote project/');
  if (folder && !folder.endsWith('/')) folder += '/';
  if (folder.startsWith('/')) folder = folder.substring(1);

  if (!repo) throw new Error("GitHub Repository is not configured.");

  const filepath = `${folder}${filename}`.replace(/\/\//g, '/');
  const endpoint = `/repos/${repo}/contents/${filepath}`;

  // 1. Check if file already exists to get its SHA (required for updating)
  let sha = null;
  try {
    const existing = await createGithubRequest(`${endpoint}?ref=${branch}`);
    sha = existing.sha;
  } catch (e) {
    // If it throws Not Found, it's a new file, sha remains null
    if (!e.message.includes('Not Found')) {
      throw e;
    }
  }

  // 2. Put file contents
  const body = {
    message: `Sync project ${filename} via LocKit`,
    content: btoaUTF8(jsonString),
    branch: branch
  };
  if (sha) body.sha = sha;

  await createGithubRequest(endpoint, 'PUT', body);
}
