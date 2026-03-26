chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'open_ai_panel') {
    // Store both the prompt and the model type so injections know what to do
    chrome.storage.local.set({ 
      pendingAiPrompt: message.prompt,
      activeAiModel: message.model
    }, () => {
      // Try to open the side panel in the sender's window
      if (sender.tab && sender.tab.windowId) {
        chrome.sidePanel.open({ windowId: sender.tab.windowId })
          .catch(err => console.error('Failed to open side panel:', err));
      } else {
        // Fallback for current window
        chrome.windows.getCurrent({ populate: false }, (window) => {
          chrome.sidePanel.open({ windowId: window.id })
            .catch(err => console.error('Failed to open side panel:', err));
        });
      }
    });
    sendResponse({ success: true });
  }
  return true;
});
