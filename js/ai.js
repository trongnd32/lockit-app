// ── AI Translation ───────────────────────────────────────────────────────────
// Builds a structured prompt for ChatGPT and either copies it to the clipboard
// or shows it in a fallback textarea, then opens chatgpt.com in a new tab.

const AI_STYLES = [
  { id: 'natural', label: 'Natural', desc: 'Conversational, feels native to the language' },
  { id: 'polite', label: 'Polite', desc: 'Respectful and courteous tone' },
  { id: 'formal', label: 'Formal', desc: 'Professional, stiff register' },
  { id: 'casual', label: 'Casual', desc: 'Friendly, relaxed, informal' },
  { id: 'playful', label: 'Playful', desc: 'Fun, energetic, for games targeting younger players' },
  { id: 'epic', label: 'Epic', desc: 'Dramatic, heroic fantasy tone' },
  { id: 'other', label: 'Other…', desc: 'Type your own style instruction' },
];

let _selectedAiStyle = 'natural';

function openAiTrans(id) {
  const s = db.strings.get(id);
  if (!s) return;

  const langs = getLangs().filter(l => l !== 'en');
  const enText = s.langs['en'] || '';

  let savedLangs = [];
  try { savedLangs = JSON.parse(localStorage.getItem('ai_selected_langs') || '[]'); } catch(e){}
  const savedStyle = localStorage.getItem('ai_selected_style') || 'natural';

  const langChips = langs.length
    ? langs.map(l => {
        const isSelected = savedLangs.includes(l);
        return `
        <label class="ai-lang-chip ${isSelected ? 'selected' : ''}" id="ai-chip-${l}">
          <input type="checkbox" value="${l}" onchange="toggleAiChip('${l}')" ${isSelected ? 'checked' : ''}>
          <span>${l.toUpperCase()}</span>
        </label>`;
      }).join('')
    : '<span style="color:var(--text-muted);font-size:12px">No non-EN languages found.</span>';

  const styleChips = AI_STYLES.map(st => `
    <div class="style-chip" id="style-chip-${st.id}"
         onclick="selectAiStyle('${st.id}')" title="${st.desc}">${st.label}</div>`).join('');

  showModal(`
    <div class="modal modal-lg" onclick="event.stopPropagation()">
      <div class="modal-title">✦ AI Translation</div>
      <div class="modal-sub">
        The prompt will be sent to your configured AI Translation Engine.
      </div>

      <div class="form-group">
        <label class="form-label">String ID</label>
        <div style="font-family:var(--mono);font-size:12px;color:var(--accent);
                    padding:6px 8px;background:var(--bg);border:1px solid var(--border);
                    border-radius:4px">${escHtml(id)}</div>
      </div>

      <div class="form-group">
        <label class="form-label">Source Text (EN)</label>
        <div style="font-size:13px;padding:6px 8px;background:var(--bg);
                    border:1px solid var(--border);border-radius:4px;color:var(--text)">
          ${escHtml(enText || '(no English text)')}
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Target Languages</label>
        <div class="ai-lang-grid">${langChips}</div>
      </div>

      <div class="form-group">
        <label class="form-label">Translation Style</label>
        <div class="style-grid">${styleChips}</div>
        <input type="text" class="form-input" id="ai-style-custom"
               placeholder="Describe your own style…" style="margin-top:8px;display:none">
      </div>

      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModalForce()">Cancel</button>
        <button class="btn btn-ai" style="padding:7px 18px;font-size:12px;width:auto"
                onclick='launchAiTrans(${JSON.stringify(id)})'>✦ Open AI</button>
      </div>
    </div>`);

  selectAiStyle(savedStyle);
  const customInput = document.getElementById('ai-style-custom');
  if (savedStyle === 'other' && customInput) {
    customInput.value = localStorage.getItem('ai_custom_style') || '';
  }
}

function toggleAiChip(lang) {
  const chip = document.getElementById(`ai-chip-${lang}`);
  if (chip) chip.classList.toggle('selected', chip.querySelector('input').checked);
}

function selectAiStyle(id) {
  _selectedAiStyle = id;
  document.querySelectorAll('.style-chip').forEach(el => el.classList.remove('selected'));
  document.getElementById(`style-chip-${id}`)?.classList.add('selected');
  const customInput = document.getElementById('ai-style-custom');
  if (customInput) customInput.style.display = id === 'other' ? 'block' : 'none';
}

function _buildAiPrompt(id) {
  const s = db.strings.get(id);
  const enText = s.langs['en'] || '(no English text provided)';
  const targets = [...document.querySelectorAll('.ai-lang-chip input:checked')].map(i => i.value);

  if (!targets.length) { alert('Please select at least one target language.'); return null; }

  localStorage.setItem('ai_selected_langs', JSON.stringify(targets));
  localStorage.setItem('ai_selected_style', _selectedAiStyle);

  let styleLabel, styleDesc;
  if (_selectedAiStyle === 'other') {
    styleLabel = 'Custom';
    styleDesc = document.getElementById('ai-style-custom')?.value.trim() || 'natural';
    localStorage.setItem('ai_custom_style', styleDesc);
  } else {
    const st = AI_STYLES.find(x => x.id === _selectedAiStyle);
    styleLabel = st?.label || 'Natural';
    styleDesc = st?.desc || 'natural, native-sounding';
  }

  const targetList = targets.map(l => `- ${l.toUpperCase()}`).join('\n');
  const project = currentProjectName || 'Unknown Game';

  return `You are a professional game localization translator working on the game "${project}".

## Task
Translate the following UI/game string into the specified target language(s). Provide ONLY the translated text for each language — no explanations, no alternatives, no commentary.

## String Metadata
- String ID: ${id}
- Category: ${s.category}
- Source language: English (EN)

## Source Text
${enText}

## Target Language(s)
${targetList}

## Translation Style
${styleLabel}: ${styleDesc}

## Context & Rules
- This is a game UI/narrative string. Preserve any placeholders like {0}, {1}, %s, %d, [NAME] exactly as-is.
- Keep the same tone and energy as the source.
- Do not add, remove, or reorder meaning.
- If a term has no direct equivalent, choose the most natural localization.

## Output Format
Return ONLY a JSON object like:
{
${targets.map(l => `  "${l}": "<translated text>"`).join(',\n')}
}`;
}

function launchAiTrans(id) {
  const prompt = _buildAiPrompt(id);
  if (!prompt) return;

  const model = localStorage.getItem('lockit_settings_ai_model') || 'chatgpt';

  // Send request to the extension to open AI side panel
  document.dispatchEvent(new CustomEvent('TranslManager_OpenAI', { 
    detail: { prompt, model } 
  }));
  
  closeModalForce();
  setStatus('Requested extension to open AI side panel (' + model + ')…');
}
