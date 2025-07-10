// Chrome messaging and storage API wrappers
// Extracted from scraper.js during modularization

// Save profiles to background script
async function saveProfiles(profiles) {
  try {
    // Always send message to ensure database initialization, even with empty arrays
    const response = await chrome.runtime.sendMessage({
      type: "SAVE_PROFILES",
      data: profiles || [],
    });

    if (response && response.success) {
      if (profiles && profiles.length > 0) {
        console.log(
          `Saved ${response.saved} profiles. Total in DB: ${response.total}`
        );
      } else {
        console.log(
          `No profiles to save, but database initialized. Total in DB: ${response.total}`
        );
      }
    } else {
      const errorMessage = response?.error || "Unknown error occurred";
      console.error("Failed to save profiles:", errorMessage);
    }
  } catch (error) {
    console.error("Error saving profiles:", error);
  }
}

// Send scraping complete message
async function notifyScrapingComplete() {
  try {
    await chrome.runtime.sendMessage({
      type: "SCRAPE_DONE",
    });
  } catch (error) {
    console.error("Error sending scraping complete message:", error);
  }
}

// Generic message sender with error handling
async function sendMessage(messageType, data = {}) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: messageType,
      ...data,
    });
    return response;
  } catch (error) {
    console.error(`Error sending message ${messageType}:`, error);
    return { success: false, error: error.message };
  }
}

// Export functions using consolidated namespace
if (window.LinkedInScraper && window.LinkedInScraper.registerModule) {
  window.LinkedInScraper.registerModule('StorageApi', {
    saveProfiles,
    notifyScrapingComplete,
    sendMessage
  });
} else {
  // Fallback for backward compatibility during transition
  window.LinkedInScraperStorageApi = {
    saveProfiles,
    notifyScrapingComplete,
    sendMessage
  };
}

console.log("storageApi.js module loaded");
