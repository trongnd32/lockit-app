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

  showModal(`
    <div class="modal modal-md" onclick="event.stopPropagation()">
      <div class="modal-title">⚙ Settings</div>
      <div class="modal-sub">Configure LocKit preferences</div>
      
      <div class="form-group" style="margin-top: 20px;">
        <label class="form-label">AI Translation Engine</label>
        <select class="form-input" id="setting-ai-model" onchange="saveSetting('ai_model', this.value)">
          <option value="chatgpt" ${currentAiModel === 'chatgpt' ? 'selected' : ''}>ChatGPT</option>
          <option value="gemini" ${currentAiModel === 'gemini' ? 'selected' : ''}>Google Gemini</option>
        </select>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">
          * Requires the LocKit Translation extension.
        </div>
      </div>

      <div class="modal-actions" style="margin-top: 30px;">
        <button class="btn btn-ghost" onclick="closeModalForce()">Close</button>
      </div>
    </div>
  `);
}

function saveSetting(key, value) {
  setSetting(key, value);
  setStatus('Setting saved.');
}
