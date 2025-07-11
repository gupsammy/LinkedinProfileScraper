// Enhanced module loading system with retry logic and graceful failure handling
// Improves reliability of Chrome extension module loading

class ModuleLoader {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
    this.exponentialBackoff = true;
    this.debug = false;
    // Prefix used to auto-discover scraper modules on the global window.
    this.modulePrefix = "LinkedInScraper";

    /**
     * Critical modules are the minimum required for the extension to work
     * at all.  If any of these fail to load we *must* retry / report an
     * unrecoverable failure.  All other modules are treated as optional –
     * they enhance functionality but the scraper can still run in a
     * degraded mode without them.
     */
    this.criticalModules = [
      "LinkedInScraperUtils",
      "LinkedInScraperController",
      "LinkedInScraperMessageBridge",
    ];

    // Cache of last "snapshot" of detected modules – purely informational.
    this.detectedModules = [];
    this.loadAttempts = 0;
    this.failureReasons = [];
  }

  // Check for debug flag and other config in storage to enable verbose logging
  async _initializeConfig(overrides = {}) {
    let storageConfig = {};
    try {
      const items = await chrome.storage.local.get([
        "module_loader_config",
        "debug_mode",
      ]);
      storageConfig = items.module_loader_config || {};
      if (items.debug_mode) {
        storageConfig.debug = true;
      }
    } catch (e) {
      // This can happen in sandboxed environments, fall back to defaults.
      console.warn("Could not access chrome.storage.local for config.", e);
    }

    // Precedence: overrides > storageConfig > defaults
    this.maxRetries =
      overrides.maxRetries ?? storageConfig.maxRetries ?? this.maxRetries;
    this.retryDelay =
      overrides.retryDelay ?? storageConfig.retryDelay ?? this.retryDelay;
    this.exponentialBackoff =
      overrides.exponentialBackoff ??
      storageConfig.exponentialBackoff ??
      this.exponentialBackoff;
    this.debug = overrides.debug ?? storageConfig.debug ?? this.debug;
  }

  // Main entry point for module loading with retry logic
  async loadModulesWithRetry(configOverrides) {
    await this._initializeConfig(configOverrides);
    this.debug && console.log("🔄 Starting enhanced module loading...");

    for (
      this.loadAttempts = 1;
      this.loadAttempts <= this.maxRetries;
      this.loadAttempts++
    ) {
      this.debug &&
        console.log(
          `📦 Module loading attempt ${this.loadAttempts}/${this.maxRetries}`
        );

      const result = await this.checkModuleAvailability();

      if (result.success) {
        this.debug && console.log("✅ All modules loaded successfully!");
        return result;
      }

      // Log failure reason for this attempt
      this.failureReasons.push({
        attempt: this.loadAttempts,
        missingModules: result.missingModules,
        timestamp: new Date().toISOString(),
      });

      if (this.loadAttempts < this.maxRetries) {
        const delay = this.calculateRetryDelay();
        this.debug &&
          console.warn(
            `⚠️ Attempt ${this.loadAttempts} failed. Retrying in ${delay}ms...`
          );
        this.debug &&
          console.warn(`Missing modules: ${result.missingModules.join(", ")}`);

        await this.sleep(delay);

        // Try to reload failed modules
        await this.attemptModuleReload(result.missingModules);
      }
    }

    // All attempts failed
    return this.handleLoadFailure();
  }

  // Check module availability with detailed reporting
  async checkModuleAvailability() {
    // Discover all LinkedInScraper-prefixed globals *currently* on window.
    const discovered = Object.keys(window).filter(
      (key) =>
        key.startsWith(this.modulePrefix) &&
        key !== "LinkedInScraperModuleLoader"
    );

    // Save snapshot for diagnostics.
    this.detectedModules = discovered;

    // Determine which critical modules are missing.
    const missingCritical = this.criticalModules.filter(
      (name) => !window[name]
    );

    // Non-critical but useful modules (present vs. missing) – informational only.
    const availableModules = discovered.filter((name) => !!window[name]);

    const success = missingCritical.length === 0;

    if (success) {
      this.debug &&
        console.log(
          `✅ Module check passed: All critical modules present (${availableModules.length} total modules detected)`
        );
    } else {
      this.debug &&
        console.warn(
          "❌ Critical modules missing:",
          missingCritical.join(", ")
        );
    }

    return {
      success,
      availableModules,
      missingModules: missingCritical, // Only report critical missing ones for retry logic
      totalModules: discovered.length,
      loadAttempt: this.loadAttempts,
    };
  }

  /**
   * Dispatches a custom event on the document to signal a module reload attempt.
   * This is a "hail-mary" attempt to resolve loading issues, potentially by
   * allowing other scripts (if any were designed to listen for this) to react.
   * The event carries the list of failed modules for diagnostics.
   *
   * @param {string[]} failedModules - The names of modules that failed to load.
   */
  async attemptModuleReload(failedModules) {
    this.debug &&
      console.log(
        `🔧 Attempting to reload ${failedModules.length} failed modules...`
      );

    // Wait a bit longer for async module loading
    await this.sleep(500);

    // Note: Removed forced garbage collection to prevent performance issues
    // gc() can cause noticeable pauses and is not necessary for normal operation

    // Trigger a document event that might help with module loading
    if (typeof document !== "undefined") {
      const event = new CustomEvent("moduleReloadAttempt", {
        detail: {
          failedModules,
          attempt: this.loadAttempts,
        },
      });
      document.dispatchEvent(event);
    }
  }

  // Calculate retry delay with exponential backoff
  calculateRetryDelay() {
    if (this.exponentialBackoff) {
      return this.retryDelay * Math.pow(2, this.loadAttempts - 1);
    }
    return this.retryDelay;
  }

  // Handle complete loading failure with graceful degradation
  handleLoadFailure() {
    console.error("❌ Module loading failed after all retry attempts");
    console.error("📊 Failure summary:", this.failureReasons);

    const lastFailure = this.failureReasons[this.failureReasons.length - 1];
    const criticalModules = this.identifyCriticalModules(
      lastFailure.missingModules
    );

    // Attempt graceful degradation
    if (criticalModules.length === 0) {
      this.debug &&
        console.log(
          "🎯 No critical modules missing, attempting graceful degradation..."
        );
      return this.attemptGracefulDegradation(lastFailure.missingModules);
    }

    // Show user-friendly error message
    this.showUserErrorMessage(lastFailure.missingModules);

    // Report to background script for debugging
    this.reportLoadFailureToBackground();

    return {
      success: false,
      error: "Module loading failed",
      missingModules: lastFailure.missingModules,
      criticalFailure: criticalModules.length > 0,
      failureReasons: this.failureReasons,
    };
  }

  // Identify which modules are critical for basic functionality
  identifyCriticalModules(missingModules) {
    return missingModules.filter((module) =>
      this.criticalModules.includes(module)
    );
  }

  // Attempt to run with reduced functionality
  attemptGracefulDegradation(missingModules) {
    this.debug && console.log("🔄 Attempting graceful degradation...");

    // Check if core functionality is available
    const hasUtils = window.LinkedInScraperUtils;
    const hasController = window.LinkedInScraperController;
    const hasMessageBridge = window.LinkedInScraperMessageBridge;

    if (hasUtils && hasController && hasMessageBridge) {
      this.debug &&
        console.log(
          "✅ Core modules available, enabling limited functionality"
        );

      // Initialize message bridge at minimum
      if (hasMessageBridge.initializeMessageBridge) {
        hasMessageBridge.initializeMessageBridge();
      }

      return {
        success: true,
        degraded: true,
        availableFunctionality: ["message_handling"],
        missingModules,
        warning: "Extension running with limited functionality",
      };
    }

    console.error(
      "❌ Critical modules missing, cannot provide graceful degradation"
    );
    return {
      success: false,
      error: "Critical module failure",
      missingModules,
    };
  }

  // Show user-friendly error message
  showUserErrorMessage(missingModules) {
    if (window.LinkedInScraperNotifier) {
      window.LinkedInScraperNotifier.show({
        id: "module-load-error",
        type: "toast",
        title: "LinkedIn Scraper Error",
        message: "Extension failed to load properly. Try refreshing the page.",
        details: `Missing: ${missingModules.slice(0, 3).join(", ")}${
          missingModules.length > 3 ? "..." : ""
        }`,
        duration: 10000,
      });
    }
  }

  // Report failure to background script for debugging
  reportLoadFailureToBackground() {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      try {
        chrome.runtime.sendMessage({
          type: "MODULE_LOAD_FAILURE",
          data: {
            url: window.location.href,
            failureReasons: this.failureReasons,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error("Failed to report module load failure:", error);
      }
    } else {
      this.debug &&
        console.log(
          "Cannot report to background, chrome.runtime not available."
        );
    }
  }

  // Utility sleep function
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Get loading statistics for debugging
  getLoadingStats() {
    return {
      attempts: this.loadAttempts,
      maxRetries: this.maxRetries,
      failureReasons: this.failureReasons,
      criticalModules: this.criticalModules,
      detectedModules: this.detectedModules,
    };
  }
}

// Create and export singleton instance
const moduleLoader = new ModuleLoader();

// Export for use in other modules
window.LinkedInScraperModuleLoader = moduleLoader;

// Final log is removed from here as debug state is not known at load time.
// It is now handled inside _initializeConfig
