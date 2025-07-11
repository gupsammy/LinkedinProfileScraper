// Simple, elegant module verification
// Replaces the over-engineered ModuleLoader with a maintainable solution

function ensureModulesLoaded() {
  const criticalModules = [
    "LinkedInScraperUtils",
    "LinkedInScraperController",
    "LinkedInScraperMessageBridge",
  ];

  const missing = criticalModules.filter((name) => !window[name]);

  if (missing.length === 0) {
    console.log("✅ All critical modules loaded successfully");
    return true;
  }

  console.error("❌ Critical modules missing:", missing);
  console.error(
    "💡 This usually indicates a script loading error. Check browser console for syntax errors."
  );

  // Simple user feedback with option to reload
  const userChoice = confirm(
    "LinkedIn Scraper failed to load properly.\n\n" +
      "Missing critical modules: " +
      missing.join(", ") +
      "\n\n" +
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
      "⚠️ Optional modules missing (reduced functionality):",
      missing
    );
    return false;
  }

  console.log("✅ All optional modules loaded");
  return true;
}

// Export the simple checker
window.LinkedInScraperModuleChecker = {
  ensureModulesLoaded,
  checkOptionalModules,
};

console.log("moduleChecker.js loaded - simple and elegant module verification");
