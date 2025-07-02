// Popup JavaScript for LinkedIn Profile Scraper

class PopupController {
  constructor() {
    this.elements = {
      statusBadge: document.getElementById("statusBadge"),
      profileCount: document.getElementById("profileCount"),
      btnStart: document.getElementById("btnStart"),
      btnStop: document.getElementById("btnStop"),
      btnExport: document.getElementById("btnExport"),
      btnImport: document.getElementById("btnImport"),
      btnClear: document.getElementById("btnClear"),
      importFile: document.getElementById("importFile"),
      progressSection: document.getElementById("progressSection"),
      progressText: document.getElementById("progressText"),
      progressFill: document.getElementById("progressFill"),
      statusMessage: document.getElementById("statusMessage"),
    };

    this.isScrapingActive = false;
    this.init();
  }

  async init() {
    this.attachEventListeners();
    await this.updateStatus();
    this.listenForMessages();
  }

  attachEventListeners() {
    this.elements.btnStart.addEventListener("click", () =>
      this.startScraping()
    );
    this.elements.btnStop.addEventListener("click", () => this.stopScraping());
    this.elements.btnExport.addEventListener("click", () => this.exportData());
    this.elements.btnImport.addEventListener("click", () => this.importData());
    this.elements.btnClear.addEventListener("click", () =>
      this.clearDatabase()
    );
    this.elements.importFile.addEventListener("change", (e) =>
      this.handleFileImport(e)
    );
  }

  listenForMessages() {
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case "SCRAPE_PROGRESS":
          this.updateProgress(message.data);
          break;
        case "SCRAPE_COMPLETE": // Normal completion
          this.handleScrapeComplete(message.data ? message.data.message : "Scraping completed successfully!");
          break;
        case "SCRAPE_ERRORED": // Scraping failed critically
          this.handleScrapeError(message.data ? message.data.message : "Scraping failed due to an unknown error.");
          break;
      }
      return true; // Indicate that the message was handled (especially for async)
    });
  }

  async updateStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
      if (response.success) {
        this.elements.profileCount.textContent = response.profileCount;
      }
    } catch (error) {
      console.error("Error getting status:", error);
      this.showMessage("Error connecting to extension", "error");
    }
  }

  async startScraping() {
    try {
      // Check if on valid page
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const currentTab = tabs[0];

      if (!(currentTab.url.includes("linkedin.com/search/results/people/?") || 
            currentTab.url.includes("linkedin.com/search/results/people?"))) {
        this.showMessage(
          "Please navigate to a LinkedIn people search page first",
          "error"
        );
        return;
      }

      // this.setScrapingState(true); // Optimistically set state, or wait for response.
                                    // Let's wait for response to be more accurate.

      const response = await chrome.runtime.sendMessage({
        type: "START_SCRAPING",
      });

      // Response from background now reflects content script's ability to start
      if (response && response.success) {
        this.setScrapingState(true); // Set state only on confirmed start
        this.showMessage(response.message || "Scraping started successfully!", "success");
        this.elements.progressSection.style.display = "block";
        this.elements.progressText.textContent = "Scraping initiated..."; // Initial progress text
      } else {
        // this.setScrapingState(false); // Already false or will be set by error handler
        this.showMessage(response.error || "Failed to start scraping. Check console for details.", "error");
      }
    } catch (error) { // This catches errors in chrome.runtime.sendMessage itself (e.g., background not reachable)
      console.error("Error sending START_SCRAPING message:", error);
      this.setScrapingState(false);
      this.showMessage("Error trying to start scraping: " + error.message, "error");
    }
  }

  async stopScraping() {
    try {
      this.setScrapingState(false);

      const response = await chrome.runtime.sendMessage({
        type: "STOP_SCRAPING",
      });
      if (response.success) {
        this.showMessage("Scraping stopped", "info");
        this.elements.progressSection.style.display = "none";
      }
    } catch (error) {
      console.error("Error stopping scraping:", error);
      this.showMessage("Error stopping scraping", "error");
    }
  }

  async exportData() {
    try {
      this.elements.btnExport.classList.add("loading");

      const response = await chrome.runtime.sendMessage({
        type: "REQUEST_EXPORT",
      });

      if (response.success && response.data) {
        const data = response.data;
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });

        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `linkedin_profiles_${
          new Date().toISOString().split("T")[0]
        }.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showMessage(
          `Exported ${data.length} profiles successfully`,
          "success"
        );
      } else {
        this.showMessage("No data to export", "info");
      }
    } catch (error) {
      console.error("Error exporting data:", error);
      this.showMessage("Error exporting data", "error");
    } finally {
      this.elements.btnExport.classList.remove("loading");
    }
  }

  importData() {
    this.elements.importFile.click();
  }

  async handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      this.elements.btnImport.classList.add("loading");

      const text = await file.text();
      const data = JSON.parse(text);

      // Validate data format
      if (!Array.isArray(data)) {
        throw new Error("Invalid file format. Expected an array of profiles.");
      }

      // Validate profile structure
      const requiredFields = ["id", "name", "url"];
      for (const profile of data) {
        for (const field of requiredFields) {
          if (!profile[field]) {
            throw new Error(
              `Invalid profile data. Missing required field: ${field}`
            );
          }
        }
      }

      const response = await chrome.runtime.sendMessage({
        type: "IMPORT_JSON",
        data: data,
      });

      if (response.success) {
        this.showMessage(
          `Imported ${data.length} profiles successfully`,
          "success"
        );
        await this.updateStatus();
      } else {
        this.showMessage("Failed to import data", "error");
      }
    } catch (error) {
      console.error("Error importing data:", error);
      this.showMessage(`Import error: ${error.message}`, "error");
    } finally {
      this.elements.btnImport.classList.remove("loading");
      // Reset file input
      event.target.value = "";
    }
  }

  async clearDatabase() {
    if (
      !confirm(
        "Are you sure you want to clear all profile data? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      this.elements.btnClear.classList.add("loading");

      const response = await chrome.runtime.sendMessage({ type: "CLEAR_DB" });

      if (response.success) {
        this.showMessage("Database cleared successfully", "success");
        // Force update the status display
        this.elements.profileCount.textContent = "0";
        await this.updateStatus();
      } else {
        this.showMessage("Failed to clear database", "error");
      }
    } catch (error) {
      console.error("Error clearing database:", error);
      this.showMessage("Error clearing database", "error");
    } finally {
      this.elements.btnClear.classList.remove("loading");
    }
  }

  setScrapingState(isActive) {
    this.isScrapingActive = isActive;

    if (isActive) {
      this.elements.statusBadge.textContent = "Scraping";
      this.elements.statusBadge.className = "status-badge scraping";
      this.elements.btnStart.disabled = true;
      this.elements.btnStop.disabled = false;
    } else {
      this.elements.statusBadge.textContent = "Ready";
      this.elements.statusBadge.className = "status-badge";
      this.elements.btnStart.disabled = false;
      this.elements.btnStop.disabled = true;
    }
  }

  updateProgress(data) {
    if (data.saved && data.total) {
      this.elements.progressText.textContent = `Saved ${data.saved} profiles (Total: ${data.total})`;
      this.elements.profileCount.textContent = data.total;
    }
  }

  handleScrapeComplete(message = "Scraping completed successfully!") {
    this.setScrapingState(false);
    this.elements.progressSection.style.display = "none";
    this.showMessage(message, "success");
    this.updateStatus(); // Refresh profile count
  }

  handleScrapeError(errorMessage = "Scraping failed.") {
    this.setScrapingState(false);
    this.elements.progressSection.style.display = "none";
    this.showMessage(errorMessage, "error");
    this.updateStatus(); // Refresh profile count, though it might not have changed
  }

  showMessage(text, type = "info", duration = 5000) {
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }
    this.elements.statusMessage.textContent = text;
    this.elements.statusMessage.className = `status-message ${type}`;
    this.elements.statusMessage.style.display = "block"; // Make sure it's visible

    if (duration > 0) {
      this.messageTimeout = setTimeout(() => {
        this.elements.statusMessage.style.display = "none";
      }, duration);
    }
  }
}

// Initialize popup when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new PopupController();
});
