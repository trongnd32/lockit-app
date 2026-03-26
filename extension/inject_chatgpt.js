console.log("[ChatGPT Injector] Script loaded");

function attemptInjection(prompt) {
  console.log("[ChatGPT Injector] Attempting to inject prompt:", prompt.substring(0, 30) + '...');
  if (!prompt) return;
  
  let attempts = 0;
  const checkInterval = setInterval(() => {
    attempts++;
    const promptTextarea = document.querySelector('#prompt-textarea') || 
                           document.querySelector('[name="prompt-textarea"]') || 
                           document.querySelector('div[contenteditable="true"]');

    if (promptTextarea) {
      console.log("[ChatGPT Injector] Found textarea", promptTextarea.tagName, promptTextarea.id);
      clearInterval(checkInterval);

      promptTextarea.focus();

      if (promptTextarea.tagName === 'TEXTAREA' || promptTextarea.tagName === 'INPUT') {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set ||
                             Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        if (nativeSetter) {
          nativeSetter.call(promptTextarea, prompt);
        } else {
          promptTextarea.value = prompt;
        }
        promptTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        promptTextarea.focus();
        let success = document.execCommand('insertText', false, prompt);
        if (!success) {
           console.log("[ChatGPT Injector] execCommand failed, trying paste event");
           const dataTransfer = new DataTransfer();
           dataTransfer.setData('text/plain', prompt);
           promptTextarea.dispatchEvent(new ClipboardEvent('paste', {
             clipboardData: dataTransfer,
             bubbles: true,
             cancelable: true
           }));
        }
        promptTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      }

      console.log("[ChatGPT Injector] Text injected. Waiting to click submit...");

      setTimeout(() => {
        const btn = document.querySelector('button[data-testid="send-button"]') || 
                    document.querySelector('button[aria-label="Send prompt"]') ||
                    document.querySelector('button[aria-label="Submit message"]');
        if (btn && !btn.disabled) {
          console.log("[ChatGPT Injector] Clicking submit button", btn.cloneNode());
          btn.click();
        } else {
          console.log("[ChatGPT Injector] Submit button not found or disabled, sending Enter key");
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
      console.log("[ChatGPT Injector] Gave up after 30 seconds");
      clearInterval(checkInterval);
    }
  }, 500);
}

chrome.storage.local.get(['pendingAiPrompt', 'activeAiModel'], (result) => {
  console.log("[ChatGPT Injector] Initial check for prompt:", result);
  if (result.activeAiModel === 'chatgpt' && result.pendingAiPrompt) {
    const prompt = result.pendingAiPrompt;
    chrome.storage.local.remove('pendingAiPrompt');
    attemptInjection(prompt);
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.pendingAiPrompt && changes.pendingAiPrompt.newValue) {
    chrome.storage.local.get(['activeAiModel'], (res) => {
      if (res.activeAiModel === 'chatgpt') {
        console.log("[ChatGPT Injector] Prompt changed in storage");
        const prompt = changes.pendingAiPrompt.newValue;
        chrome.storage.local.remove('pendingAiPrompt');
        attemptInjection(prompt);
      }
    });
  }
});
