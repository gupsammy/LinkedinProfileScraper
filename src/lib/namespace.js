"use strict";
// Consolidated namespace for LinkedIn Profile Scraper
// This module provides a single entry point for all scraper functionality

// Initialize the main namespace object
window.LinkedInScraper = {
  // Global debug flag – set to false in production builds to silence diagnostic logs
  DEBUG: true,
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
  Entry: {},
};

// Helper function to safely register a module
function registerModule(moduleName, moduleExports) {
  if (window.LinkedInScraper && window.LinkedInScraper[moduleName]) {
    // Warn if any keys already exist on the target module namespace
    Object.keys(moduleExports).forEach((key) => {
      if (window.LinkedInScraper[moduleName][key] !== undefined) {
        console.warn(
          `LinkedInScraper: duplicate export '${key}' on module '${moduleName}' – existing value will be overwritten`
        );
      }
    });

    Object.assign(window.LinkedInScraper[moduleName], moduleExports);
    if (window.LinkedInScraper.DEBUG) {
      console.log(`✅ Module ${moduleName} registered successfully`);
    }
  } else {
    console.error(`❌ Failed to register module ${moduleName}`);
  }
}

// Export registration function for use by other modules
window.LinkedInScraper.registerModule = registerModule;

if (window.LinkedInScraper.DEBUG) {
  console.log("✅ Consolidated namespace initialized");
}
