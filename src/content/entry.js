// Main entry point for modular scraper
// Replaces scraper.js as the bootstrap file

// Initialize the scraper system
function initializeScraperSystem() {
  console.log("LinkedIn Profile Scraper content script loaded");
  console.log("Current URL:", location.href);
  console.log("Current pathname:", location.pathname);

  const controller = window.LinkedInScraper?.Controller || window.LinkedInScraperController;
  const messageBridge = window.LinkedInScraper?.MessageBridge || window.LinkedInScraperMessageBridge;

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
  const selectors = window.LinkedInScraper?.Selectors || window.LinkedInScraperSelectors;
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

// Check if all required modules are loaded
function checkModuleAvailability() {
  // Check for consolidated namespace first
  if (window.LinkedInScraper) {
    const requiredModules = [
      'Utils', 'Selectors', 'Pagination', 'Extractor', 
      'Validator', 'StorageApi', 'State', 'Controller', 
      'MessageBridge', 'Entry'
    ];
    
    const missingModules = [];
    const availableModules = [];
    
    requiredModules.forEach((moduleName) => {
      if (window.LinkedInScraper[moduleName] && Object.keys(window.LinkedInScraper[moduleName]).length > 0) {
        availableModules.push(`LinkedInScraper.${moduleName}`);
      } else {
        missingModules.push(`LinkedInScraper.${moduleName}`);
      }
    });
    
    console.log(
      `✅ Consolidated namespace modules (${availableModules.length}):`,
      availableModules
    );
    
    if (missingModules.length > 0) {
      console.warn(
        `⚠️ Missing consolidated modules (${missingModules.length}):`,
        missingModules
      );
    }
    
    return missingModules.length === 0;
  }
  
  // Fallback to legacy individual modules check
  const modules = [
    "LinkedInScraperUtils",
    "LinkedInScraperSelectors", 
    "LinkedInScraperPagination",
    "LinkedInScraperExtractor",
    "LinkedInScraperValidator",
    "LinkedInScraperStorageApi",
    "LinkedInScraperState",
    "LinkedInScraperController",
    "LinkedInScraperMessageBridge",
  ];

  const missingModules = [];
  const availableModules = [];

  modules.forEach((moduleName) => {
    if (window[moduleName]) {
      availableModules.push(moduleName);
    } else {
      missingModules.push(moduleName);
    }
  });

  console.log(
    `✅ Legacy modules (${availableModules.length}):`,
    availableModules
  );

  if (missingModules.length > 0) {
    console.error(
      `❌ Missing legacy modules (${missingModules.length}):`,
      missingModules
    );
    return false;
  }

  return true;
}

// Main initialization function
function init() {
  console.log("🚀 Initializing modular LinkedIn scraper...");

  if (!checkModuleAvailability()) {
    console.error("❌ Cannot initialize - missing required modules");
    return;
  }

  console.log("✅ All modules loaded successfully");
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
      const messageBridge = window.LinkedInScraper?.MessageBridge || window.LinkedInScraperMessageBridge;
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

// Wait for DOM to be ready, then initialize
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    init();
    setupNavigationListener();
  });
} else {
  init();
  setupNavigationListener();
}

// Export functions using consolidated namespace
if (window.LinkedInScraper && window.LinkedInScraper.registerModule) {
  window.LinkedInScraper.registerModule('Entry', {
    initializeScraperSystem,
    debugSelectors,
    checkModuleAvailability,
    init,
    setupNavigationListener
  });
} else {
  // Fallback for backward compatibility during transition
  window.LinkedInScraperEntry = {
    initializeScraperSystem,
    debugSelectors,
    checkModuleAvailability,
    init,
    setupNavigationListener
  };
}

console.log("entry.js module loaded");
