// Listens for custom event from the Translation Manager page
document.addEventListener('TranslManager_OpenAI', (e) => {
  if (e.detail && e.detail.prompt) {
    // Forward to the extension background script
    chrome.runtime.sendMessage({ 
      action: 'open_ai_panel', 
      prompt: e.detail.prompt,
      model: e.detail.model || 'chatgpt'
    });
  }
});
