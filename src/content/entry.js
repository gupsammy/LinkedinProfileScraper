// Main entry point for modular scraper
// Replaces scraper.js as the bootstrap file

// Initialize the scraper system
function initializeScraperSystem() {
  console.log("LinkedIn Profile Scraper content script loaded");
  console.log("Current URL:", location.href);
  console.log("Current pathname:", location.pathname);

  const controller = window.LinkedInScraperController;
  const messageBridge = window.LinkedInScraperMessageBridge;
  
  if (!controller) {
    console.error('Controller module not available');
    return;
  }

  if (!controller.isValidPeopleSearchPage()) {
    console.log("Not on a people search page, content script inactive");
    return;
  }

  console.log("On LinkedIn people search page, scraper ready");

  // Test selectors immediately for debugging
  debugSelectors();

  // Initialize message bridge
  if (messageBridge) {
    messageBridge.initializeMessageBridge();
  } else {
    console.error('Message bridge module not available');
  }

  // Check if we should continue scraping from previous page
  controller.checkContinueScraping();
}

// Debug selector functionality
function debugSelectors() {
  const selectors = window.LinkedInScraperSelectors;
  if (!selectors) {
    console.error('Selectors module not available for debugging');
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
  const modules = [
    'LinkedInScraperUtils',
    'LinkedInScraperSelectors', 
    'LinkedInScraperPagination',
    'LinkedInScraperExtractor',
    'LinkedInScraperValidator',
    'LinkedInScraperStorageApi',
    'LinkedInScraperState',
    'LinkedInScraperController',
    'LinkedInScraperMessageBridge'
  ];

  const missingModules = [];
  const availableModules = [];

  modules.forEach(moduleName => {
    if (window[moduleName]) {
      availableModules.push(moduleName);
    } else {
      missingModules.push(moduleName);
    }
  });

  console.log(`✅ Available modules (${availableModules.length}):`, availableModules);
  
  if (missingModules.length > 0) {
    console.error(`❌ Missing modules (${missingModules.length}):`, missingModules);
    return false;
  }

  return true;
}

// Main initialization function
function init() {
  console.log('🚀 Initializing modular LinkedIn scraper...');
  
  if (!checkModuleAvailability()) {
    console.error('❌ Cannot initialize - missing required modules');
    return;
  }

  console.log('✅ All modules loaded successfully');
  initializeScraperSystem();
}

// Wait for DOM to be ready, then initialize
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// Export for debugging
window.LinkedInScraperEntry = {
  initializeScraperSystem,
  debugSelectors,
  checkModuleAvailability,
  init
};

console.log('entry.js module loaded');