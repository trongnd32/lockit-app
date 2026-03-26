console.log("[Gemini Injector] Script loaded");

function attemptInjectionGemini(prompt) {
  console.log("[Gemini Injector] Attempting to inject prompt:", prompt.substring(0, 30) + '...');
  if (!prompt) return;
  
  let attempts = 0;
  const checkInterval = setInterval(() => {
    attempts++;
    
    // Target Gemini's standard input or similar contenteditables
    const promptTextarea = document.querySelector('rich-textarea div[contenteditable="true"]') ||
                           document.querySelector('rich-textarea') || 
                           document.querySelector('div[contenteditable="true"][role="textbox"]');

    if (promptTextarea) {
      console.log("[Gemini Injector] Found textarea");
      clearInterval(checkInterval);

      promptTextarea.focus();

      let success = document.execCommand('insertText', false, prompt);
      if (!success) {
         console.log("[Gemini Injector] execCommand failed, trying paste event");
         const dataTransfer = new DataTransfer();
         dataTransfer.setData('text/plain', prompt);
         promptTextarea.dispatchEvent(new ClipboardEvent('paste', {
           clipboardData: dataTransfer,
           bubbles: true,
           cancelable: true
         }));
      }
      promptTextarea.dispatchEvent(new Event('input', { bubbles: true }));

      console.log("[Gemini Injector] Text injected. Waiting to click submit...");

      setTimeout(() => {
        const btn = document.querySelector('button[aria-label="Send message"]') ||
                    document.querySelector('button[aria-label*="Send"]');
                    
        if (btn && !btn.disabled) {
          console.log("[Gemini Injector] Clicking submit button");
          btn.click();
        } else {
          console.log("[Gemini Injector] Submit button not found or disabled, sending Enter key");
          promptTextarea.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true
          }));
        }
      }, 1000);
    } else if (attempts > 60) {
      console.log("[Gemini Injector] Gave up after 30 seconds");
      clearInterval(checkInterval);
    }
  }, 500);
}

chrome.storage.local.get(['pendingAiPrompt', 'activeAiModel'], (result) => {
  console.log("[Gemini Injector] Initial check for prompt:", result);
  if (result.activeAiModel === 'gemini' && result.pendingAiPrompt) {
    const prompt = result.pendingAiPrompt;
    chrome.storage.local.remove('pendingAiPrompt');
    attemptInjectionGemini(prompt);
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.pendingAiPrompt && changes.pendingAiPrompt.newValue) {
    chrome.storage.local.get(['activeAiModel'], (res) => {
      if (res.activeAiModel === 'gemini') {
        console.log("[Gemini Injector] Prompt changed in storage");
        const prompt = changes.pendingAiPrompt.newValue;
        chrome.storage.local.remove('pendingAiPrompt');
        attemptInjectionGemini(prompt);
      }
    });
  }
});
