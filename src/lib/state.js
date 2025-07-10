// Session storage and runtime state management
// Extracted from scraper.js during modularization

// Runtime state flags
let isScrapingActive = false;
let currentPage = 1;
let totalPages = 1;
let scrapingInProgress = false;
let continueScrapingTimeout = null;

// Session storage keys
const STORAGE_KEYS = {
  ACTIVE: "scraperActive",
  STOPPED: "scraperStopped",
  CURRENT_PAGE: "scraperCurrentPage",
  TOTAL_PAGES: "scraperTotalPages",
};

// Get current scraping state
function getScrapingState() {
  return {
    isScrapingActive,
    currentPage,
    totalPages,
    scrapingInProgress,
    continueScrapingTimeout,
  };
}

// Set scraping state
function setScrapingState(state) {
  if (state.isScrapingActive !== undefined)
    isScrapingActive = state.isScrapingActive;
  if (state.currentPage !== undefined) currentPage = state.currentPage;
  if (state.totalPages !== undefined) totalPages = state.totalPages;
  if (state.scrapingInProgress !== undefined)
    scrapingInProgress = state.scrapingInProgress;
  if (state.continueScrapingTimeout !== undefined)
    continueScrapingTimeout = state.continueScrapingTimeout;
}

// Initialize scraping state
function initializeScrapingState(page, total) {
  isScrapingActive = true;
  scrapingInProgress = true;
  currentPage = page;
  totalPages = total;

  // Clear any previous stop flag and set session storage
  sessionStorage.removeItem(STORAGE_KEYS.STOPPED);
  sessionStorage.setItem(STORAGE_KEYS.ACTIVE, "true");
  sessionStorage.setItem(STORAGE_KEYS.CURRENT_PAGE, currentPage.toString());
  sessionStorage.setItem(STORAGE_KEYS.TOTAL_PAGES, totalPages.toString());
}

// Stop scraping and clear state
function stopScrapingState() {
  isScrapingActive = false;
  scrapingInProgress = false;

  // Clear any ongoing timeouts
  if (continueScrapingTimeout) {
    clearTimeout(continueScrapingTimeout);
    continueScrapingTimeout = null;
  }

  // Clear session storage and set stop flag
  sessionStorage.removeItem(STORAGE_KEYS.ACTIVE);
  sessionStorage.removeItem(STORAGE_KEYS.CURRENT_PAGE);
  sessionStorage.removeItem(STORAGE_KEYS.TOTAL_PAGES);
  sessionStorage.setItem(STORAGE_KEYS.STOPPED, "true");

  console.log("Scraping stopped");
}

// Check if scraping should continue from session storage
function checkShouldContinue() {
  const wasStopped = sessionStorage.getItem(STORAGE_KEYS.STOPPED) === "true";
  if (wasStopped) {
    console.log("Scraping was previously stopped, not resuming");
    return false;
  }

  const shouldContinue = sessionStorage.getItem(STORAGE_KEYS.ACTIVE) === "true";
  return shouldContinue;
}

// Restore state from session storage
function restoreStateFromSession() {
  const restoredCurrentPage = parseInt(
    sessionStorage.getItem(STORAGE_KEYS.CURRENT_PAGE) || "1"
  );
  const restoredTotalPages = parseInt(
    sessionStorage.getItem(STORAGE_KEYS.TOTAL_PAGES) || "1"
  );

  currentPage = restoredCurrentPage;
  totalPages = restoredTotalPages;
  isScrapingActive = true;
  scrapingInProgress = true;

  return { currentPage, totalPages };
}

// Set navigation state for next page
function setNavigationState(nextPage, total) {
  sessionStorage.setItem(STORAGE_KEYS.ACTIVE, "true");
  sessionStorage.setItem(STORAGE_KEYS.CURRENT_PAGE, nextPage.toString());
  sessionStorage.setItem(STORAGE_KEYS.TOTAL_PAGES, total.toString());
}

// Check if scraping is currently stopped
// Important: rely only on the persisted session flag. The in-memory
// `isScrapingActive` flag resets on page navigation, which caused a
// false positive and aborted the multi-page workflow. By checking only
// the dedicated STOPPED flag we accurately reflect the user's intent
// across SPA navigations.
function isScrapingStopped() {
  return sessionStorage.getItem(STORAGE_KEYS.STOPPED) === "true";
}

// Set timeout for continuing scraping
function setContinueTimeout(callback, delay = 2000) {
  if (continueScrapingTimeout) {
    clearTimeout(continueScrapingTimeout);
  }

  continueScrapingTimeout = setTimeout(callback, delay);
}

// Export functions using consolidated namespace
if (window.LinkedInScraper && window.LinkedInScraper.registerModule) {
  window.LinkedInScraper.registerModule('State', {
    getScrapingState,
    setScrapingState,
    initializeScrapingState,
    stopScrapingState,
    checkShouldContinue,
    restoreStateFromSession,
    setNavigationState,
    isScrapingStopped,
    setContinueTimeout,
    STORAGE_KEYS
  });
} else {
  // Fallback for backward compatibility during transition
  window.LinkedInScraperState = {
    getScrapingState,
    setScrapingState,
    initializeScrapingState,
    stopScrapingState,
    checkShouldContinue,
    restoreStateFromSession,
    setNavigationState,
    isScrapingStopped,
    setContinueTimeout,
    STORAGE_KEYS
  };
}

console.log("state.js module loaded");
