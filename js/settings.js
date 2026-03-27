// ── Settings ─────────────────────────────────────────────────────────────

function getSetting(key, defaultValue = null) {
  let val = localStorage.getItem('lockit_settings_' + key);
  return val !== null ? val : defaultValue;
}

function setSetting(key, value) {
  localStorage.setItem('lockit_settings_' + key, value);
}

function openSettings() {
  const currentAiModel = getSetting('ai_model', 'chatgpt');
  const currentExecMode = getSetting('ai_exec_mode', 'sidepanel');
  const chatGptApiKey = getSetting('openai_api_key', '');
  const geminiApiKey = getSetting('gemini_api_key', '');

  const githubToken = getSetting('github_token', '');
  const githubRepo = getSetting('github_repo', '');
  const githubBranch = getSetting('github_branch', 'main');
  const githubFolder = getSetting('github_folder', 'Remote project/');

  showModal(`
    <div class="modal modal-lg" onclick="event.stopPropagation()">
      <div style="display:flex; gap:30px;">
        
        <!-- Left Column: AI Settings -->
        <div style="flex:1;">
          <div class="modal-title">⚙ AI Settings</div>
          <div class="modal-sub">Configure intelligent translation</div>
          
          <div class="form-group" style="margin-top: 20px;">
            <label class="form-label">AI Translation Engine</label>
            <select class="form-input form-select" id="setting-ai-model" onchange="saveSetting('ai_model', this.value); updateSettingsUi()">
              <option value="chatgpt" ${currentAiModel === 'chatgpt' ? 'selected' : ''}>ChatGPT (OpenAI)</option>
              <option value="gemini" ${currentAiModel === 'gemini' ? 'selected' : ''}>Google Gemini</option>
            </select>
          </div>

          <div class="form-group" style="margin-top: 15px;">
            <label class="form-label">Execution Mode</label>
            <select class="form-input form-select" id="setting-exec-mode" onchange="saveSetting('ai_exec_mode', this.value); updateSettingsUi()">
              <option value="sidepanel" ${currentExecMode === 'sidepanel' ? 'selected' : ''}>Extension Side Panel (Free)</option>
              <option value="api" ${currentExecMode === 'api' ? 'selected' : ''}>Direct API Request (Requires API Key)</option>
            </select>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">
              * Extension mode requires the Translation Extension plugin.
            </div>
          </div>

          <div id="settings-api-keys" style="display: ${currentExecMode === 'api' ? 'block' : 'none'}; margin-top: 15px;">
            <div class="form-group" id="settings-openai-key" style="display: ${currentAiModel === 'chatgpt' ? 'block' : 'none'};">
              <label class="form-label">OpenAI API Key (GPT-4o)</label>
              <input type="password" class="form-input" id="setting-openai-key" value="${chatGptApiKey}" placeholder="sk-..." onblur="saveSetting('openai_api_key', this.value)">
            </div>
            
            <div class="form-group" id="settings-gemini-key" style="display: ${currentAiModel === 'gemini' ? 'block' : 'none'};">
              <label class="form-label">Gemini API Key</label>
              <input type="password" class="form-input" id="setting-gemini-key" value="${geminiApiKey}" placeholder="AIzaSy..." onblur="saveSetting('gemini_api_key', this.value)">
            </div>
          </div>
        </div>

        <!-- Right Column: GitHub Sync -->
        <div style="flex:1;">
          <div class="modal-title">☁ GitHub Cloud Sync</div>
          <div class="modal-sub">Push and pull projects remotely</div>

          <div class="form-group" style="margin-top: 20px;">
            <label class="form-label">Personal Access Token (PAT)</label>
            <input type="password" class="form-input" id="setting-github-token" value="${githubToken}" placeholder="ghp_xxxxxxxx..." onblur="saveSetting('github_token', this.value)">
          </div>
          <div class="form-group" style="margin-top: 15px;">
            <label class="form-label">Repository (e.g. username/repo-name)</label>
            <input type="text" class="form-input" id="setting-github-repo" value="${githubRepo}" placeholder="username/lockit-data" onblur="saveSetting('github_repo', this.value)">
          </div>
          <div style="display:flex; gap:10px; margin-top: 15px;">
            <div class="form-group" style="flex:1;">
              <label class="form-label">Branch</label>
              <input type="text" class="form-input" id="setting-github-branch" value="${githubBranch}" placeholder="main" onblur="saveSetting('github_branch', this.value)">
            </div>
            <div class="form-group" style="flex:1.5;">
              <label class="form-label">Folder Path</label>
              <input type="text" class="form-input" id="setting-github-folder" value="${githubFolder}" placeholder="Remote project/" onblur="saveSetting('github_folder', this.value)">
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">Include trailing slash.</div>
            </div>
          </div>
        </div>

      </div>

      <div class="modal-actions" style="margin-top: 30px;">
        <button class="btn btn-ghost" onclick="closeModalForce()">Close Settings</button>
      </div>
    </div>
  `);
}

function updateSettingsUi() {
  const model = document.getElementById('setting-ai-model')?.value;
  const execMode = document.getElementById('setting-exec-mode')?.value;
  
  const apiKeysContainer = document.getElementById('settings-api-keys');
  const openaiKeyGrp = document.getElementById('settings-openai-key');
  const geminiKeyGrp = document.getElementById('settings-gemini-key');

  if (apiKeysContainer) {
    apiKeysContainer.style.display = execMode === 'api' ? 'block' : 'none';
  }
  if (openaiKeyGrp) {
    openaiKeyGrp.style.display = model === 'chatgpt' ? 'block' : 'none';
  }
  if (geminiKeyGrp) {
    geminiKeyGrp.style.display = model === 'gemini' ? 'block' : 'none';
  }
}

function saveSetting(key, value) {
  setSetting(key, value);
  setStatus('Setting saved.');
}
