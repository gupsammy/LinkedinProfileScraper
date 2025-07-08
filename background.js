// Background Service Worker for LinkedIn Profile Scraper
// Handles IndexedDB operations and message routing

const DB_NAME = "linkedin_profiles";
const DB_VERSION = 1;
const STORE_NAME = "profiles";

class ProfileDatabase {
  constructor() {
    this.db = null;
    this.initPromise = this.init();
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("scrapedAt", "scrapedAt", { unique: false });
          store.createIndex("name", "name", { unique: false });
        }
      };
    });
  }

  async ensureReady() {
    if (!this.db) {
      await this.initPromise;
    }
    return this.db;
  }

  async putMany(profiles) {
    await this.ensureReady();
    const transaction = this.db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const promises = profiles.map((profile) => {
      return new Promise((resolve, reject) => {
        const request = store.put(profile);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });

    await Promise.all(promises);
    return profiles.length;
  }

  async export() {
    await this.ensureReady();
    const transaction = this.db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async import(profiles) {
    await this.ensureReady();
    return this.putMany(profiles);
  }

  async clear() {
    await this.ensureReady();
    const transaction = this.db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getCount() {
    await this.ensureReady();
    const transaction = this.db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Initialize database
const db = new ProfileDatabase();

// Test database initialization and make it visible in DevTools
(async () => {
  try {
    await db.ensureReady();
    console.log(`✅ IndexedDB '${DB_NAME}' initialized successfully`);
    console.log(`📊 Database version: ${DB_VERSION}`);
    console.log(`🗂️ Object store: ${STORE_NAME}`);

    const count = await db.getCount();
    console.log(`📈 Current profile count in DB: ${count}`);

    // Force database visibility by performing operations that make it appear in DevTools
    const testTransaction = db.db.transaction([STORE_NAME], "readonly");
    const testStore = testTransaction.objectStore(STORE_NAME);
    console.log(
      `🔍 Database stores: [${Array.from(db.db.objectStoreNames).join(", ")}]`
    );
    console.log(`🔧 Available indexes: scrapedAt, name`);

    // Perform a small operation to ensure database shows in DevTools
    const testRequest = testStore.getAllKeys();
    testRequest.onsuccess = () => {
      console.log(
        `🗝️ Database contains ${testRequest.result.length} profile keys`
      );
      console.log(
        `🔗 View database: Chrome DevTools > Application > IndexedDB > ${DB_NAME}`
      );
    };
  } catch (error) {
    console.error("❌ Failed to initialize IndexedDB:", error);
    console.log(
      "💡 Troubleshooting: Check if extension has storage permissions"
    );
  }
})();

// Message handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case "SAVE_PROFILES":
          console.log(`Attempting to save ${msg.data.length} profiles...`);
          console.log("Sample profile data:", msg.data[0]);
          const count = await db.putMany(msg.data);
          const totalCount = await db.getCount();
          console.log(
            `Successfully saved ${count} profiles. Total in DB: ${totalCount}`
          );
          sendResponse({ success: true, saved: count, total: totalCount });

          // Notify popup of progress if it's open
          try {
            chrome.runtime.sendMessage({
              type: "SCRAPE_PROGRESS",
              data: { saved: count, total: totalCount },
            });
          } catch (e) {
            // Popup might not be open, ignore
          }
          break;

        case "REQUEST_EXPORT":
          const profiles = await db.export();
          sendResponse({ success: true, data: profiles });
          break;

        case "IMPORT_JSON":
          await db.import(msg.data);
          const newTotal = await db.getCount();
          sendResponse({ success: true, total: newTotal });
          break;

        case "CLEAR_DB":
          console.log("🗑️ Clearing all profiles from database...");
          await db.clear();
          const finalCount = await db.getCount();
          console.log(`✅ Database cleared. Profile count: ${finalCount}`);
          sendResponse({ success: true, profileCount: finalCount });
          break;

        case "GET_STATUS":
          console.log("📊 Getting database status...");
          const status = await db.getCount();
          console.log(`📈 Current profile count: ${status}`);
          sendResponse({ success: true, profileCount: status });
          break;

        case "START_SCRAPING":
          // Forward to active tab
          const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type: "START_SCRAPING" });
          }
          sendResponse({ success: true });
          break;

        case "STOP_SCRAPING":
          // Broadcast STOP_SCRAPING to all LinkedIn tabs so it is received even if the page is mid-navigation
          const linkedInTabs = await chrome.tabs.query({
            url: "*://*.linkedin.com/*",
          });

          // Send the stop message to each tab that might have an active scraper
          for (const tabInfo of linkedInTabs) {
            try {
              chrome.tabs.sendMessage(tabInfo.id, { type: "STOP_SCRAPING" });
            } catch (e) {
              // Tab might not have the content script injected yet – ignore
            }
          }

          sendResponse({ success: true, tabsNotified: linkedInTabs.length });
          break;

        case "SCRAPE_DONE":
          console.log("Scraping completed!");
          // Notify popup
          try {
            chrome.runtime.sendMessage({
              type: "SCRAPE_COMPLETE",
              data: { message: "Scraping completed successfully!" },
            });
          } catch (e) {
            // Popup might not be open, ignore
          }
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: "Unknown message type" });
      }
    } catch (error) {
      console.error("Background script error:", error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true; // Keep message channel open for async response
});

// Listen for tab updates to detect navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    (tab.url?.includes("linkedin.com/search/results/people/?") ||
      tab.url?.includes("linkedin.com/search/results/people?")) // Handle both formats
  ) {
    // Page loaded, content script will handle detection
  }
});

console.log("LinkedIn Profile Scraper background script loaded");
