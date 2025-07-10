"use strict";
// Consolidated namespace for LinkedIn Profile Scraper
// This module provides a single entry point for all scraper functionality

// Ensure we do not overwrite an existing namespace created earlier (e.g., after Chrome SPA navigations)
window.LinkedInScraper = window.LinkedInScraper || {};

const root = window.LinkedInScraper;

// Default debug flag – disabled by default to avoid noisy logs in production.
// Developers can enable it manually or via build-time environment injection.
if (typeof root.DEBUG === "undefined") {
  root.DEBUG = false;
}

// Ensure required sub-namespaces exist even if this script executes multiple times.
[
  "Utils",
  "Selectors",
  "Pagination",
  "Extractor",
  "Validator",
  "StorageApi",
  "State",
  "Controller",
  "MessageBridge",
  "Entry",
].forEach((key) => {
  if (!root[key]) {
    root[key] = {};
  }
});

// Helper function to safely register a module
function registerModule(moduleName, moduleExports) {
  if (!root[moduleName]) {
    root[moduleName] = {};
  }

  // Warn if any keys already exist on the target module namespace
  Object.keys(moduleExports).forEach((key) => {
    if (root[moduleName][key] !== undefined) {
      console.warn(
        `LinkedInScraper: duplicate export '${key}' on module '${moduleName}' – existing value will be overwritten`
      );
    }
  });

  Object.assign(root[moduleName], moduleExports);

  if (root.DEBUG) {
    console.log(`✅ Module ${moduleName} registered successfully`);
  }
}

// Expose registration helper exactly once
if (!root.registerModule) {
  root.registerModule = registerModule;
}

if (root.DEBUG) {
  console.log("✅ Consolidated namespace initialized (idempotent)");
}
