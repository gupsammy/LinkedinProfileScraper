// Background Service Worker for LinkedIn Profile Scraper
// Handles IndexedDB operations and message routing

const DB_NAME = "linkedin_profiles";
const DB_VERSION = 1;
const STORE_NAME = "profiles";

class ProfileDatabase {
  constructor() {
    this.db = null;
    this.isInitializing = false;
    this.initPromise = null;
    this.ensureInitialization();
  }

  async ensureInitialization() {
    if (this.db) return this.db;
    if (this.isInitializing) return this.initPromise;

    this.isInitializing = true;
    this.initPromise = this.init();

    try {
      await this.initPromise;
      this.isInitializing = false;
      return this.db;
    } catch (error) {
      this.isInitializing = false;
      console.error("❌ Database initialization failed:", error);
      throw error;
    }
  }

  async init() {
    return new Promise((resolve, reject) => {
      console.log(`🔄 Initializing IndexedDB '${DB_NAME}'...`);

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("❌ IndexedDB open failed:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log(`✅ IndexedDB '${DB_NAME}' opened successfully`);

        // Add error handler for the database connection
        this.db.onerror = (event) => {
          console.error("❌ Database error:", event.target.error);
        };

        // Add close handler to detect if database is closed
        this.db.onclose = () => {
          console.warn("⚠️ Database connection closed unexpectedly");
          this.db = null;
        };

        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        console.log(`🔧 Upgrading database to version ${DB_VERSION}...`);
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("scrapedAt", "scrapedAt", { unique: false });
          store.createIndex("name", "name", { unique: false });
          console.log(`📁 Created object store '${STORE_NAME}' with indexes`);
        }
      };
    });
  }

  async ensureReady() {
    if (!this.db || this.db.readyState === "closed") {
      console.log("🔄 Database not ready, reinitializing...");
      await this.ensureInitialization();
    }
    return this.db;
  }

  async putMany(profiles) {
    await this.ensureReady();

    if (!profiles || profiles.length === 0) {
      console.log("📝 No profiles to save, but ensuring database exists");
      return 0;
    }

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
    console.log(`💾 Successfully saved ${profiles.length} profiles`);
    return profiles.length;
  }

  async export() {
    await this.ensureReady();
    const transaction = this.db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        console.log(`📤 Exported ${request.result.length} profiles`);
        resolve(request.result);
      };
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
      request.onsuccess = () => {
        console.log(`🗑️ Successfully cleared all profiles from database`);
        resolve(request.result);
      };
      request.onerror = () => {
        console.error("❌ Failed to clear database:", request.error);
        reject(request.error);
      };
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

  // Add a health check method
  async healthCheck() {
    try {
      await this.ensureReady();
      const count = await this.getCount();
      console.log(`💚 Database health check passed. Current count: ${count}`);
      return { healthy: true, count };
    } catch (error) {
      console.error("❌ Database health check failed:", error);
      return { healthy: false, error: error.message };
    }
  }
}

// Initialize database
const db = new ProfileDatabase();

// Periodic health check to ensure database stays healthy and visible
function startPeriodicHealthCheck() {
  // Run health check every 30 seconds
  setInterval(async () => {
    try {
      const health = await db.healthCheck();
      if (!health.healthy) {
        console.warn(
          "⚠️ Periodic health check failed, attempting to reinitialize..."
        );
        await db.ensureInitialization();
      }
    } catch (error) {
      console.error("❌ Periodic health check error:", error);
    }
  }, 30000); // 30 seconds

  console.log("⏰ Periodic database health monitoring started");
}

// Force database visibility in Chrome DevTools
async function forceDbVisibility() {
  try {
    await db.ensureReady();

    // Perform multiple operations to ensure DevTools detects the database
    const transaction = db.db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    // Create a dummy operation to ensure database is visible
    const dummyOperation = store.openCursor();
    dummyOperation.onsuccess = () => {
      console.log("🔍 Database cursor operation completed for visibility");
    };

    // Also perform index operations
    const nameIndex = store.index("name");
    const indexOperation = nameIndex.openCursor();
    indexOperation.onsuccess = () => {
      console.log("🔍 Database index operation completed for visibility");
    };

    console.log("🔍 Database visibility operations initiated");
  } catch (error) {
    console.error("❌ Error forcing database visibility:", error);
  }
}

// Enhanced database initialization and visibility
(async () => {
  try {
    console.log("🚀 LinkedIn Profile Scraper Extension Started");

    // Force immediate database initialization
    await db.ensureInitialization();

    console.log(`✅ IndexedDB '${DB_NAME}' initialized successfully`);
    console.log(`📊 Database version: ${DB_VERSION}`);
    console.log(`🗂️ Object store: ${STORE_NAME}`);

    // Perform health check
    const health = await db.healthCheck();
    console.log(
      `🔍 Database stores: [${Array.from(db.db.objectStoreNames).join(", ")}]`
    );
    console.log(`🔧 Available indexes: scrapedAt, name`);

    // Force database visibility by performing a comprehensive test
    const testTransaction = db.db.transaction([STORE_NAME], "readwrite");
    const testStore = testTransaction.objectStore(STORE_NAME);

    // Get all keys to trigger database visibility
    const getAllKeysRequest = testStore.getAllKeys();
    getAllKeysRequest.onsuccess = () => {
      console.log(
        `🗝️ Database contains ${getAllKeysRequest.result.length} profile keys`
      );
      console.log(
        `🔗 View database: Chrome DevTools > Application > IndexedDB > ${DB_NAME}`
      );
      console.log(`📱 Extension ready for use!`);
    };

    // Also trigger a count operation to ensure database appears in DevTools
    const countRequest = testStore.count();
    countRequest.onsuccess = () => {
      console.log(`📊 Profile count verified: ${countRequest.result}`);
    };

    // Start periodic health monitoring
    startPeriodicHealthCheck();

    // Force database visibility in DevTools
    await forceDbVisibility();
  } catch (error) {
    console.error("❌ Failed to initialize IndexedDB:", error);
    console.log("💡 Troubleshooting:");
    console.log("   - Check if extension has storage permissions");
    console.log("   - Try reloading the extension");
    console.log("   - Check for quota exceeded errors");
  }
})();

// Ensure database is ready when service worker activates
self.addEventListener("activate", async (event) => {
  console.log("🔄 Service worker activated, ensuring database ready...");
  event.waitUntil(db.ensureInitialization());
});

// Ensure database is ready when Chrome starts
chrome.runtime.onStartup.addListener(async () => {
  console.log("🔄 Chrome startup detected, ensuring database ready...");
  try {
    await db.ensureInitialization();
    console.log("✅ Database ready on Chrome startup");
  } catch (error) {
    console.error("❌ Error initializing database on startup:", error);
  }
});

// Ensure database is ready when extension is installed or enabled
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`🔄 Extension ${details.reason}, ensuring database ready...`);
  try {
    await db.ensureInitialization();
    console.log(`✅ Database ready after ${details.reason}`);
  } catch (error) {
    console.error(
      `❌ Error initializing database on ${details.reason}:`,
      error
    );
  }
});

// Message handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case "SAVE_PROFILES":
          console.log(`Attempting to save ${msg.data.length} profiles...`);

          // Ensure database is initialized even for empty arrays
          await db.ensureInitialization();

          let count = 0;
          if (msg.data.length > 0) {
            console.log("Sample profile data:", msg.data[0]);
            count = await db.putMany(msg.data);
          } else {
            console.log("Empty profile array - ensuring database is ready");
          }

          const totalCount = await db.getCount();
          console.log(
            `Successfully processed ${count} profiles. Total in DB: ${totalCount}`
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
          console.log("📤 Exporting profiles...");
          const profiles = await db.export();
          sendResponse({ success: true, data: profiles });
          break;

        case "IMPORT_JSON":
          console.log(`📥 Importing ${msg.data.length} profiles...`);
          await db.import(msg.data);
          const newTotal = await db.getCount();
          console.log(`✅ Import completed. Total profiles: ${newTotal}`);
          sendResponse({ success: true, total: newTotal });
          break;

        case "CLEAR_DB":
          console.log("🗑️ Clearing all profiles from database...");
          try {
            // Ensure database is ready before attempting to clear
            await db.ensureInitialization();
            await db.clear();
            const finalCount = await db.getCount();
            console.log(
              `✅ Database cleared successfully. Profile count: ${finalCount}`
            );
            sendResponse({ success: true, profileCount: finalCount });
          } catch (error) {
            console.error("❌ Error clearing database:", error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case "GET_STATUS":
          console.log("📊 Getting database status...");
          try {
            // Ensure database is initialized before getting status
            await db.ensureInitialization();
            const status = await db.getCount();
            const health = await db.healthCheck();
            console.log(`📈 Current profile count: ${status}`);
            sendResponse({
              success: true,
              profileCount: status,
              healthy: health.healthy,
            });
          } catch (error) {
            console.error("❌ Error getting status:", error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case "HEALTH_CHECK":
          console.log("🏥 Performing database health check...");
          const healthResult = await db.healthCheck();
          sendResponse({ success: true, health: healthResult });
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

        case "MODULE_LOAD_FAILURE":
          console.error("📊 Module load failure reported from content script:");
          console.error("URL:", msg.data.url);
          console.error("User Agent:", msg.data.userAgent);
          console.error("Failure Reasons:", msg.data.failureReasons);
          console.error("Timestamp:", msg.data.timestamp);
          
          // Store failure information for debugging
          const failureKey = `module_load_failure_${Date.now()}`;
          try {
            await chrome.storage.local.set({
              [failureKey]: {
                ...msg.data,
                reportedAt: new Date().toISOString()
              }
            });
            console.log("📝 Module failure logged to storage:", failureKey);
          } catch (error) {
            console.error("Failed to store module failure:", error);
          }
          
          sendResponse({ success: true, logged: true });
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
