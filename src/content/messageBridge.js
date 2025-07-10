// Chrome runtime message handling
// Extracted from scraper.js during modularization

// Handle incoming Chrome runtime messages
function handleRuntimeMessage(message, _sender, sendResponse) {
  const controller = window.LinkedInScraperController;
  
  if (!controller) {
    console.error('Controller module not available');
    sendResponse({ success: false, error: "Controller module not available" });
    return true;
  }

  switch (message.type) {
    case "START_SCRAPING":
      try {
        controller.startScraping();
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error starting scraping:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;

    case "STOP_SCRAPING":
      try {
        controller.stopScraping();
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error stopping scraping:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;

    default:
      console.warn('Unknown message type:', message.type);
      sendResponse({ success: false, error: "Unknown message type" });
  }

  return true; // Keep the message channel open for async responses
}

// Initialize message listener
function initializeMessageBridge() {
  if (chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    console.log('Message bridge initialized');
  } else {
    console.error('Chrome runtime API not available');
  }
}

// Export functions
window.LinkedInScraperMessageBridge = {
  handleRuntimeMessage,
  initializeMessageBridge
};

console.log('messageBridge.js module loaded');