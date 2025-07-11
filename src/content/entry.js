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
  const selectors = window.LinkedInScraperSelectors;
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
    `✅ Available modules (${availableModules.length}):`,
    availableModules
  );

  if (missingModules.length > 0) {
    console.error(
      `❌ Missing modules (${missingModules.length}):`,
      missingModules
    );
    return false;
  }

  return true;
}

// Enhanced initialization function with robust module loading
async function init() {
  console.log("🚀 Initializing modular LinkedIn scraper with enhanced module loading...");

  // Use enhanced module loader if available
  const moduleLoader = window.LinkedInScraperModuleLoader;
  
  if (moduleLoader) {
    console.log("📦 Using enhanced module loader...");
    
    const loadResult = await moduleLoader.loadModulesWithRetry();
    
    if (loadResult.success) {
      if (loadResult.degraded) {
        console.warn("⚠️ Extension running with limited functionality:", loadResult.warning);
        console.warn("Available functionality:", loadResult.availableFunctionality);
      } else {
        console.log("✅ All modules loaded successfully via enhanced loader");
      }
      
      // Proceed with initialization
      initializeScraperSystem();
      return;
    } else {
      console.error("❌ Enhanced module loading failed:", loadResult.error);
      
      if (loadResult.criticalFailure) {
        console.error("💥 Critical modules missing, cannot proceed");
        showCriticalFailureMessage(loadResult);
        return;
      }
      
      // Fall through to legacy check as last resort
      console.log("🔄 Falling back to legacy module checking...");
    }
  } else {
    console.warn("⚠️ Enhanced module loader not available, using legacy method");
  }

  // Legacy module checking (fallback)
  if (!checkModuleAvailability()) {
    console.error("❌ Cannot initialize - missing required modules");
    return;
  }

  console.log("✅ All modules loaded successfully via legacy check");
  initializeScraperSystem();
}

// Show critical failure message to user
function showCriticalFailureMessage(loadResult) {
  console.error("💥 Critical module loading failure");
  console.error("Missing critical modules:", loadResult.missingModules);
  
  // Try to show user-friendly message
  if (typeof document !== 'undefined') {
    // Check if critical error message already exists to avoid duplicates
    const existingError = document.getElementById('linkedin-scraper-critical-error');
    if (existingError) {
      console.log('Critical error message already displayed, skipping duplicate');
      return;
    }

    const errorDiv = document.createElement('div');
    errorDiv.id = 'linkedin-scraper-critical-error';
    errorDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ff4757;
      color: white;
      padding: 20px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      text-align: center;
      z-index: 2147483647;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      pointer-events: auto;
    `;
    
    errorDiv.innerHTML = `
      <h3>LinkedIn Scraper - Critical Error</h3>
      <p>The extension failed to load properly.</p>
      <p><strong>Please refresh the page and try again.</strong></p>
      <small>If the problem persists, try disabling and re-enabling the extension.</small>
    `;
    
    document.body.appendChild(errorDiv);
    
    // Store timeout reference for cleanup
    const timeoutId = setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 15000);

    // Store timeout reference on the element for potential cleanup
    errorDiv._timeoutId = timeoutId;
  }
}

// Clean up error messages and pending timeouts
function cleanupErrorMessages() {
  // Clean up error messages with stored timeout IDs
  const errorElements = [
    document.getElementById('linkedin-scraper-error'),
    document.getElementById('linkedin-scraper-critical-error')
  ];

  errorElements.forEach(element => {
    if (element) {
      // Clear stored timeout if it exists
      if (element._timeoutId) {
        clearTimeout(element._timeoutId);
        console.log('Cleared timeout for error message:', element.id);
      }
      
      // Remove the element
      if (element.parentNode) {
        element.parentNode.removeChild(element);
        console.log('Removed error message element:', element.id);
      }
    }
  });
}

// Listen for navigation changes to reinitialize message bridge
function setupNavigationListener() {
  // Listen for pushState/popState navigation (LinkedIn uses SPA routing)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  function handleNavigation() {
    console.log("Navigation detected, cleaning up and reinitializing message bridge...");
    
    // Clean up any error messages and timeouts before navigation
    cleanupErrorMessages();
    
    setTimeout(() => {
      const messageBridge = window.LinkedInScraperMessageBridge;
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

  // Clean up on page unload to prevent memory leaks
  window.addEventListener("beforeunload", () => {
    console.log("Page unloading, cleaning up error messages...");
    cleanupErrorMessages();
  });

  console.log("Navigation listener setup complete");
}

// Wait for DOM to be ready, then initialize with async support
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      await init();
      setupNavigationListener();
    } catch (error) {
      console.error("❌ Initialization failed:", error);
      console.error("Stack trace:", error.stack);
    }
  });
} else {
  // Use async IIFE to handle async init when DOM is already ready
  (async () => {
    try {
      await init();
      setupNavigationListener();
    } catch (error) {
      console.error("❌ Initialization failed:", error);
      console.error("Stack trace:", error.stack);
    }
  })();
}

// Export for debugging
window.LinkedInScraperEntry = {
  initializeScraperSystem,
  debugSelectors,
  checkModuleAvailability,
  init,
  setupNavigationListener,
  showCriticalFailureMessage,
  cleanupErrorMessages
};

console.log("entry.js module loaded");
