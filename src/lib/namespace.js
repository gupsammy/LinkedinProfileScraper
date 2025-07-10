"use strict";
// Consolidated namespace for LinkedIn Profile Scraper
// This module provides a single entry point for all scraper functionality

// Preserve any previously-defined global (legacy) namespace
const existingGlobal = window.LinkedInScraper || {};

// Build a key that is (mostly) unique per-extension to avoid clashes with other extensions
const extId =
  typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id
    ? chrome.runtime.id
    : "default";
const NS_KEY = `LinkedInScraper_${extId}`;

// Initialise (or reuse) the root namespace
window[NS_KEY] = window[NS_KEY] || {};

// Merge any existing legacy namespace state (if this script ran before) so we don't lose references
Object.assign(window[NS_KEY], existingGlobal);

// Alias for backwards compatibility – old code still references window.LinkedInScraper
window.LinkedInScraper = window[NS_KEY];

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
      const msg = `LinkedInScraper: duplicate export '${key}' on module '${moduleName}' – existing value will be overwritten`;
      if (root.DEBUG) {
        // In development / debug builds, fail fast so collisions surface immediately.
        throw new Error(msg);
      }
      console.warn(msg);
    }
  });

  Object.assign(root[moduleName], moduleExports);

  // Automatically bridge to legacy global, eg. window.LinkedInScraperUtils
  window[`LinkedInScraper${moduleName}`] = root[moduleName];

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
