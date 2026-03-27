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

  showModal(`
    <div class="modal modal-md" onclick="event.stopPropagation()">
      <div class="modal-title">⚙ Settings</div>
      <div class="modal-sub">Configure LocKit preferences</div>
      
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
          * Extension mode opens the configured engine in your browser sidebar automatically.
        </div>
      </div>

      <div id="settings-api-keys" style="display: ${currentExecMode === 'api' ? 'block' : 'none'}; margin-top: 15px; border-top: 1px solid var(--border); padding-top: 15px;">
        <div class="form-group" id="settings-openai-key" style="display: ${currentAiModel === 'chatgpt' ? 'block' : 'none'};">
          <label class="form-label">OpenAI API Key (GPT-4o)</label>
          <input type="password" class="form-input" id="setting-openai-key" value="${chatGptApiKey}" placeholder="sk-..." onblur="saveSetting('openai_api_key', this.value)">
        </div>
        
        <div class="form-group" id="settings-gemini-key" style="display: ${currentAiModel === 'gemini' ? 'block' : 'none'};">
          <label class="form-label">Gemini API Key (Gemini 3 Flash)</label>
          <input type="password" class="form-input" id="setting-gemini-key" value="${geminiApiKey}" placeholder="AIzaSy..." onblur="saveSetting('gemini_api_key', this.value)">
        </div>
      </div>

      <div class="modal-actions" style="margin-top: 30px;">
        <button class="btn btn-ghost" onclick="closeModalForce()">Close</button>
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
