// Consolidated namespace for LinkedIn Profile Scraper
// This module provides a single entry point for all scraper functionality

// Initialize the main namespace object
window.LinkedInScraper = {
  // Core utilities
  Utils: {},
  
  // DOM selectors
  Selectors: {},
  
  // Pagination functionality
  Pagination: {},
  
  // Profile extraction
  Extractor: {},
  
  // Data validation
  Validator: {},
  
  // Storage API
  StorageApi: {},
  
  // State management
  State: {},
  
  // Workflow controller
  Controller: {},
  
  // Message bridge
  MessageBridge: {},
  
  // Entry point
  Entry: {}
};

// Helper function to safely register a module
function registerModule(moduleName, moduleExports) {
  if (window.LinkedInScraper && window.LinkedInScraper[moduleName]) {
    Object.assign(window.LinkedInScraper[moduleName], moduleExports);
    console.log(`✅ Module ${moduleName} registered successfully`);
  } else {
    console.error(`❌ Failed to register module ${moduleName}`);
  }
}

// Export registration function for use by other modules
window.LinkedInScraper.registerModule = registerModule;

console.log('✅ Consolidated namespace initialized');