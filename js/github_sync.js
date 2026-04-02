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

  const options = { method, headers, cache: 'no-store' };
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
  
  if (Array.isArray(fileData)) {
    throw new Error(`Expected a file but found a directory at ${filepath}`);
  }

  // Best approach: Always try download_url first. It avoids the 1MB base64 limit of the
  // Content API, and directly handles UTF-8 streaming without manual atob logic.
  if (fileData.download_url) {
    // raw.githubusercontent URLs for private repos ALREADY contain a token.
    // Putting Authorization headers can sometimes conflict or 400.
    const res = await fetch(fileData.download_url);
    if (res.ok) {
      const text = await res.text();
      // Only return if it's not surprisingly empty, or if the file is actually 0 bytes.
      if (text.trim() !== "" || fileData.size === 0) {
        return text;
      }
    }
  }

  if (fileData.encoding === 'base64' && fileData.content) {
    return atobUTF8(fileData.content.replace(/\n/g, ''));
  }

  if ((fileData.encoding === 'utf-8' || fileData.encoding === 'utf8') && fileData.content) {
    return fileData.content;
  }

  if ((!fileData.encoding || fileData.encoding === 'none') && typeof fileData.content === 'string') {
    if (fileData.content.trim() !== "" || fileData.size === 0) {
      return fileData.content;
    }
  }

  throw new Error(`Failed to resolve GitHub file. Encoding: "${fileData.encoding}", Size: ${fileData.size} bytes. Missing download_url or empty payload.`);
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
