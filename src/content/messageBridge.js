// Chrome runtime message handling
// Extracted from scraper.js during modularization

// Handle incoming Chrome runtime messages
function handleRuntimeMessage(message, _sender, sendResponse) {
  const controller = window.LinkedInScraper.getNS("Controller");

  if (!controller) {
    console.error("Controller module not available");
    sendResponse({ success: false, error: "Controller module not available" });
    return true;
  }

  switch (message.type) {
    case "START_SCRAPING":
      try {
        controller.startScraping();
        sendResponse({ success: true });
      } catch (error) {
        console.error("Error starting scraping:", error);
        sendResponse({ success: false, error: error.message });
      }
      break;

    case "STOP_SCRAPING":
      try {
        controller.stopScraping();
        sendResponse({ success: true });
      } catch (error) {
        console.error("Error stopping scraping:", error);
        sendResponse({ success: false, error: error.message });
      }
      break;

    default:
      console.warn("Unknown message type:", message.type);
      sendResponse({ success: false, error: "Unknown message type" });
  }

  return true; // Keep the message channel open for async responses
}

// Initialize message listener
function initializeMessageBridge() {
  if (chrome && chrome.runtime && chrome.runtime.onMessage) {
    // Remove any existing listener to prevent duplicates
    if (window.linkedInScraperMessageListener) {
      chrome.runtime.onMessage.removeListener(
        window.linkedInScraperMessageListener
      );
    }

    // Store reference to the listener for later removal
    window.linkedInScraperMessageListener = handleRuntimeMessage;
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    console.log("Message bridge initialized");
  } else {
    console.error("Chrome runtime API not available");
  }
}

// Export functions using consolidated namespace
if (window.LinkedInScraper && window.LinkedInScraper.registerModule) {
  window.LinkedInScraper.registerModule("MessageBridge", {
    handleRuntimeMessage,
    initializeMessageBridge,
  });
}

console.log("messageBridge.js module loaded");
