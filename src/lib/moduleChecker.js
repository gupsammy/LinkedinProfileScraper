// Simple, elegant module verification
// Works with both namespace and legacy module systems

function ensureModulesLoaded() {
  // First, check if the namespace system is working
  if (window.LinkedInScraper && window.LinkedInScraper.getNS) {
    const criticalModules = ["Utils", "Controller", "MessageBridge"];
    const missing = criticalModules.filter((name) => {
      const module = window.LinkedInScraper.getNS(name);
      return !module || Object.keys(module).length === 0;
    });

    if (missing.length === 0) {
      console.log(
        "✅ All critical modules loaded successfully (via namespace)"
      );
      return true;
    }

    console.error("❌ Critical namespace modules missing:", missing);
  } else {
    // Fallback to legacy module checking
    const criticalModules = [
      "LinkedInScraperUtils",
      "LinkedInScraperController",
      "LinkedInScraperMessageBridge",
    ];

    const missing = criticalModules.filter((name) => !window[name]);

    if (missing.length === 0) {
      console.log("✅ All critical modules loaded successfully (legacy)");
      return true;
    }

    console.error("❌ Critical legacy modules missing:", missing);
  }

  console.error(
    "💡 This usually indicates a script loading error. Check browser console for syntax errors."
  );

  // Simple user feedback with option to reload
  const userChoice = confirm(
    "LinkedIn Scraper failed to load properly.\n\n" +
      "Click OK to refresh the page, or Cancel to continue anyway."
  );

  if (userChoice) {
    location.reload();
    return false;
  }

  return false;
}

// Optional: Check for non-critical modules and warn about reduced functionality
function checkOptionalModules() {
  if (window.LinkedInScraper && window.LinkedInScraper.getNS) {
    const optionalModules = [
      "Selectors",
      "Pagination",
      "Extractor",
      "Validator",
      "StorageApi",
      "State",
    ];
    const missing = optionalModules.filter((name) => {
      const module = window.LinkedInScraper.getNS(name);
      return !module || Object.keys(module).length === 0;
    });

    if (missing.length > 0) {
      console.warn(
        "⚠️ Optional namespace modules missing (reduced functionality):",
        missing
      );
      return false;
    }

    console.log("✅ All optional namespace modules loaded");
    return true;
  } else {
    // Legacy fallback
    const optionalModules = [
      "LinkedInScraperSelectors",
      "LinkedInScraperPagination",
      "LinkedInScraperExtractor",
      "LinkedInScraperValidator",
      "LinkedInScraperStorageApi",
      "LinkedInScraperState",
    ];

    const missing = optionalModules.filter((name) => !window[name]);

    if (missing.length > 0) {
      console.warn(
        "⚠️ Optional legacy modules missing (reduced functionality):",
        missing
      );
      return false;
    }

    console.log("✅ All optional legacy modules loaded");
    return true;
  }
}

// Export the simple checker
window.LinkedInScraperModuleChecker = {
  ensureModulesLoaded,
  checkOptionalModules,
};

console.log("moduleChecker.js loaded - simple and elegant module verification");
