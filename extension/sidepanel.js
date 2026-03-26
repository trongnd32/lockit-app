const URL_CHATGPT = "https://chatgpt.com/";
const URL_GEMINI = "https://gemini.google.com/app";

function updateIframe(model) {
  const iframe = document.getElementById('ai-frame');
  const targetUrl = model === 'gemini' ? URL_GEMINI : URL_CHATGPT;
  
  // Only change src if it's pointing to a different domain
  if (!iframe.src || !iframe.src.startsWith(targetUrl)) {
    iframe.src = targetUrl;
  }
}

// Read current active model on initial load
chrome.storage.local.get(['activeAiModel'], (result) => {
  const model = result.activeAiModel || 'chatgpt';
  updateIframe(model);
});

// Listen for updates from background.js
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.activeAiModel) {
    const newModel = changes.activeAiModel.newValue;
    if (newModel) {
      updateIframe(newModel);
    }
  }
});
