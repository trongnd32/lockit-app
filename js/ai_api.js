// ── Direct API Integration ──────────────────────────────────────────────────

async function doApiTranslation(id, prompt, model, apiKey) {
  setStatus('Generating translation... Please wait.');
  
  showModal(`
    <div class="modal modal-md" onclick="event.stopPropagation()">
      <div class="modal-title">Generating...</div>
      <div class="modal-sub" style="margin-top:10px;">Waiting for ${model === 'gemini' ? 'Google Gemini' : 'OpenAI'} API response...</div>
    </div>
  `);

  try {
    let jsonResult = null;
    
    if (model === 'chatgpt') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o', // default to GPT-4o mapping for fast translations
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: "json_object" }
        })
      });
      if (!response.ok) throw new Error(`OpenAI API Error: ${response.status}`);
      const data = await response.json();
      const text = data.choices[0].message.content;
      jsonResult = JSON.parse(text);
    } else {
      // Gemini (Latest API)
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      if (!response.ok) throw new Error(`Gemini API Error: ${response.status}`);
      const data = await response.json();
      const text = data.candidates[0].content.parts[0].text;
      jsonResult = JSON.parse(text);
    }

    showAiApiResultsModal(id, jsonResult);
    
  } catch (error) {
    console.error(error);
    showModal(`
      <div class="modal modal-md" onclick="event.stopPropagation()">
        <div class="modal-title" style="color:var(--accent2)">Error</div>
        <div class="modal-sub">API request failed: ${error.message}</div>
        <div class="modal-actions" style="margin-top:20px;">
          <button class="btn btn-ghost" onclick="closeModalForce()">Close</button>
        </div>
      </div>
    `);
  }
}

function showAiApiResultsModal(id, results) {
  const rows = Object.entries(results).map(([lang, text]) => {
    return `
      <div style="display:flex; align-items:flex-start; margin-bottom:10px; gap:8px;">
        <div style="width:40px; font-family:var(--mono); color:var(--text-muted); padding-top:6px;">${lang.toUpperCase()}</div>
        <textarea class="form-input form-textarea" id="ai-res-${lang}" style="flex:1; min-height:60px;">${escHtml(text)}</textarea>
        <button class="btn btn-primary" style="padding:6px 12px;" onclick="applyAiTranslation('${id}', '${lang}', event)">Apply</button>
      </div>
    `;
  }).join('');

  showModal(`
    <div class="modal modal-lg" onclick="event.stopPropagation()">
      <div class="modal-title">Translation Results (API)</div>
      <div class="modal-sub">String: <span style="font-family:var(--mono)">${escHtml(id)}</span></div>
      
      <div style="margin-top:20px; max-height:60vh; overflow-y:auto; padding-right:5px;">
        ${rows}
      </div>

      <div class="modal-actions" style="margin-top: 20px;">
        <button class="btn btn-ghost" onclick="closeModalForce()">Close</button>
      </div>
    </div>
  `);
}

function applyAiTranslation(id, lang, event) {
  const s = db.strings.get(id);
  if (!s) return;
  
  const textArea = document.getElementById(`ai-res-${lang}`);
  if (!textArea) return;

  s.langs[lang] = textArea.value;
  db.strings.set(id, s);
  
  renderTable();
  setStatus(`Applied "${lang}" translation for ${id}`);
  
  const btn = event.currentTarget;
  if (btn && btn.tagName === 'BUTTON') {
    btn.textContent = 'Applied';
    btn.classList.replace('btn-primary', 'btn-ghost');
    btn.disabled = true;
  }
}
