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
      btnHealthCheck: document.getElementById("btnHealthCheck"),
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
    this.elements.btnHealthCheck.addEventListener("click", () =>
      this.runHealthCheck()
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
        case "SCRAPE_COMPLETE":
          this.handleScrapeComplete();
          break;
      }
    });
  }

  async updateStatus() {
    try {
      console.log("🔄 Updating popup status...");

      const response = await chrome.runtime.sendMessage({ type: "GET_STATUS" });

      if (response && response.success) {
        this.elements.profileCount.textContent = response.profileCount || "0";
        console.log(`✅ Status updated: ${response.profileCount} profiles`);

        // Update UI based on database health if available
        if (response.healthy === false) {
          this.showMessage("Database health check failed", "error");
        }
      } else {
        const errorMessage = response?.error || "Unable to get status";
        console.error("❌ Get status failed:", errorMessage);
        this.elements.profileCount.textContent = "?";
        this.showMessage(`Status error: ${errorMessage}`, "error");
      }
    } catch (error) {
      console.error("❌ Error getting status:", error);
      this.elements.profileCount.textContent = "?";
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

      if (
        !(
          currentTab.url.includes("linkedin.com/search/results/people/?") ||
          currentTab.url.includes("linkedin.com/search/results/people?") ||
          currentTab.url.includes("/search/results/people/") ||
          (currentTab.url.includes("/search/results/people") &&
            currentTab.url.includes("?"))
        )
      ) {
        this.showMessage(
          "Please navigate to a LinkedIn people search page first",
          "error"
        );
        return;
      }

      this.setScrapingState(true);

      const response = await chrome.runtime.sendMessage({
        type: "START_SCRAPING",
      });
      if (response.success) {
        this.showMessage("Scraping started successfully", "success");
        this.elements.progressSection.style.display = "block";
      } else {
        this.setScrapingState(false);
        this.showMessage("Failed to start scraping", "error");
      }
    } catch (error) {
      console.error("Error starting scraping:", error);
      this.setScrapingState(false);
      this.showMessage("Error starting scraping", "error");
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
      this.showMessage("Clearing database...", "info");

      const response = await chrome.runtime.sendMessage({ type: "CLEAR_DB" });

      if (response && response.success) {
        this.showMessage("Database cleared successfully", "success");
        // Update the status display with the actual count from the response
        this.elements.profileCount.textContent = response.profileCount || "0";

        // Double-check the status to ensure UI is in sync
        await this.updateStatus();

        console.log("✅ Database cleared and status updated");
      } else {
        const errorMessage = response?.error || "Unknown error occurred";
        console.error("❌ Clear database failed:", errorMessage);
        this.showMessage(`Failed to clear database: ${errorMessage}`, "error");

        // Try to get current status anyway
        await this.updateStatus();
      }
    } catch (error) {
      console.error("❌ Error clearing database:", error);
      this.showMessage(`Error clearing database: ${error.message}`, "error");

      // Still try to update status in case of communication issues
      try {
        await this.updateStatus();
      } catch (statusError) {
        console.error(
          "❌ Error updating status after clear failure:",
          statusError
        );
      }
    } finally {
      this.elements.btnClear.classList.remove("loading");
    }
  }

  async runHealthCheck() {
    try {
      this.elements.btnHealthCheck.classList.add("loading");
      this.showMessage("Running database health check...", "info");

      const response = await chrome.runtime.sendMessage({
        type: "HEALTH_CHECK",
      });

      if (response && response.success && response.health) {
        const health = response.health;

        if (health.healthy) {
          this.showMessage(
            `Database healthy! Contains ${health.count} profiles`,
            "success"
          );
          console.log("✅ Database health check passed:", health);
        } else {
          this.showMessage(`Database unhealthy: ${health.error}`, "error");
          console.error("❌ Database health check failed:", health);
        }

        // Update status after health check
        await this.updateStatus();
      } else {
        const errorMessage =
          response?.error || "Health check communication failed";
        this.showMessage(`Health check failed: ${errorMessage}`, "error");
        console.error("❌ Health check response error:", errorMessage);
      }
    } catch (error) {
      console.error("❌ Error running health check:", error);
      this.showMessage(`Health check error: ${error.message}`, "error");
    } finally {
      this.elements.btnHealthCheck.classList.remove("loading");
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

  handleScrapeComplete() {
    this.setScrapingState(false);
    this.elements.progressSection.style.display = "none";
    this.showMessage("Scraping completed successfully!", "success");
    this.updateStatus();
  }

  showMessage(text, type = "info") {
    // Ensure the message is visible each time it's shown
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }

    this.elements.statusMessage.textContent = text;
    this.elements.statusMessage.className = `status-message ${type}`;
    this.elements.statusMessage.style.display = "block";

    // Auto-hide after 5 seconds
    this.messageTimeout = setTimeout(() => {
      this.elements.statusMessage.style.display = "none";
      this.messageTimeout = null;
    }, 5000);
  }
}

// Initialize popup when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new PopupController();
});
