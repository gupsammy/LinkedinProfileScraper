// Main entry point for modular scraper
// Replaces scraper.js as the bootstrap file

// Initialize the scraper system
function initializeScraperSystem() {
  console.log("LinkedIn Profile Scraper content script loaded");
  console.log("Current URL:", location.href);
  console.log("Current pathname:", location.pathname);

  const { getNS } = window.LinkedInScraper;
  const controller = getNS("Controller");
  const messageBridge = getNS("MessageBridge");

  if (!controller) {
    console.error("Controller module not available");
    return;
  }

  // Always initialize message bridge first, regardless of page type
  // This ensures STOP messages are received even if user navigates away from valid pages
  if (messageBridge) {
    messageBridge.initializeMessageBridge();
    console.log("Message bridge initialized globally");
  } else {
    console.error("Message bridge module not available");
  }

  if (!controller.isValidPeopleSearchPage()) {
    console.log("Not on a people search page, content script inactive");
    return;
  }

  console.log("On LinkedIn people search page, scraper ready");

  // Test selectors immediately for debugging
  debugSelectors();

  // Check if we should continue scraping from previous page
  controller.checkContinueScraping();
}

// Debug selector functionality
function debugSelectors() {
  const selectors = window.LinkedInScraper.getNS("Selectors");
  if (!selectors) {
    console.error("Selectors module not available for debugging");
    return;
  }

  const { resultSelectors } = selectors;

  // Test multiple structural approaches
  const testSelectors = [
    "main ul li",
    "main div ul li",
    "main div div ul li",
    "main div div div ul li",
    "main div div div div ul li",
  ];

  testSelectors.forEach((selector) => {
    const testResults = document.querySelectorAll(selector);
    console.log(
      `Debug: Found ${testResults.length} results using '${selector}' selector`
    );
  });

  // Test other result selectors
  const alternativeSelectors = [
    "div[data-chameleon-result-urn] li",
    ".search-results-container li",
    "ul.reusable-search__entity-result-list li",
    "li[data-chameleon-result-urn]",
  ];

  alternativeSelectors.forEach((selector) => {
    const results = document.querySelectorAll(selector);
    if (results.length > 0) {
      console.log(
        `Debug: Found ${results.length} results using '${selector}' selector`
      );
    }
  });

  // Debug pagination
  const paginationElement = document.querySelector(
    "div.artdeco-pagination__page-state"
  );
  if (paginationElement) {
    console.log(
      `Debug: Pagination text: "${paginationElement.textContent.trim()}"`
    );
  } else {
    console.log("Debug: No pagination element found");
    // Try to find any pagination-related elements
    const paginationElements = document.querySelectorAll(
      '[class*="pagination"]'
    );
    console.log(
      `Debug: Found ${paginationElements.length} elements with 'pagination' in class name`
    );
    paginationElements.forEach((el, i) => {
      console.log(
        `  Pagination element ${i + 1}: ${el.className} - "${el.textContent
          .trim()
          .substring(0, 100)}"`
      );
    });
  }
}

// Simple initialization function with elegant module checking
async function init() {
  console.log("🚀 Initializing LinkedIn scraper...");

  // Give modules a brief moment to settle after page load
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Use the simple module checker
  const moduleChecker = window.LinkedInScraperModuleChecker;

  if (!moduleChecker) {
    console.error(
      "❌ Module checker not available - this indicates a critical loading failure"
    );
    alert("LinkedIn Scraper failed to load. Please refresh the page.");
    return;
  }

  // Check critical modules
  if (!moduleChecker.ensureModulesLoaded()) {
    console.error("❌ Critical module check failed - cannot proceed");
    return;
  }

  // Check optional modules and warn if any are missing
  const allOptionalLoaded = moduleChecker.checkOptionalModules();
  if (!allOptionalLoaded) {
    console.warn(
      "⚠️ Some optional modules missing - extension will have reduced functionality"
    );
  }

  console.log(
    "✅ Module verification complete - proceeding with initialization"
  );

  // Proceed with normal initialization
  initializeScraperSystem();
}

// Listen for navigation changes to reinitialize message bridge
function setupNavigationListener() {
  // Listen for pushState/popState navigation (LinkedIn uses SPA routing)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  function handleNavigation() {
    console.log("Navigation detected, reinitializing message bridge...");
    setTimeout(() => {
      const messageBridge = window.LinkedInScraper.getNS("MessageBridge");
      if (messageBridge) {
        messageBridge.initializeMessageBridge();
      }
    }, 500); // Small delay to let page settle
  }

  history.pushState = function (...args) {
    originalPushState.apply(history, args);
    handleNavigation();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(history, args);
    handleNavigation();
  };

  window.addEventListener("popstate", handleNavigation);

  console.log("Navigation listener setup complete");
}

async function start() {
  try {
    await init();
    setupNavigationListener();
  } catch (error) {
    console.error("❌ Initialization failed:", error);
    console.error("Stack trace:", error.stack);

    // Simple error handling - offer to reload
    const reload = confirm(
      "LinkedIn Scraper encountered an unexpected error during initialization.\n\n" +
        "Click OK to refresh the page and try again."
    );

    if (reload) {
      location.reload();
    }
  }
}

// Wait for DOM to be ready, then initialize
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}

// Export functions using consolidated namespace
if (window.LinkedInScraper && window.LinkedInScraper.registerModule) {
  window.LinkedInScraper.registerModule("Entry", {
    initializeScraperSystem,
    debugSelectors,
    init,
    setupNavigationListener,
  });
}

// Export for debugging (legacy support)
window.LinkedInScraperEntry = {
  initializeScraperSystem,
  debugSelectors,
  init,
  setupNavigationListener,
};

console.log("entry.js module loaded");
