// Main scraping workflow orchestration
// Extracted from scraper.js during modularization

// Start scraping process
async function startScraping() {
  const state = window.LinkedInScraperState;
  const pagination = window.LinkedInScraperPagination;
  const extractor = window.LinkedInScraperExtractor;
  const validator = window.LinkedInScraperValidator;
  const storageApi = window.LinkedInScraperStorageApi;

  if (!state || !pagination || !extractor || !validator || !storageApi) {
    console.error("Required modules not available");
    return;
  }

  const { getScrapingState } = state;
  const { scrapingInProgress } = getScrapingState();

  if (scrapingInProgress) {
    console.log("Scraping already in progress");
    return;
  }

  if (!isValidPeopleSearchPage()) {
    console.error("Not on a valid people search page");
    return;
  }

  try {
    // Get page info
    const {
      getCurrentPage,
      getTotalPages,
      ensureNextButtonReady,
      hasNextPage,
      navigateToNextPage,
    } = pagination;
    const currentPageNum = getCurrentPage();
    const totalPagesNum = getTotalPages();

    console.log(
      `Starting scraping: Page ${currentPageNum} of ${totalPagesNum}`
    );

    // Initialize state
    state.initializeScrapingState(currentPageNum, totalPagesNum);

    // Extract profiles from current page
    const extractedProfiles = extractor.extractProfilesFromPage();

    // Validate and process profiles
    const validatedProfiles = [];
    extractedProfiles.forEach((profileData) => {
      const validatedProfile = validator.createValidatedProfile(profileData);
      if (validatedProfile) {
        validatedProfiles.push(validatedProfile);
      }
    });

    if (validatedProfiles.length === 0) {
      console.warn(
        "No profiles found on current page - this might indicate selector issues"
      );
    }

    // Always save profiles (empty or not) to ensure database initialization
    await storageApi.saveProfiles(validatedProfiles);

    // Ensure paginator is active before deciding to stop
    await ensureNextButtonReady();

    // Navigate to next page if available
    const { currentPage, totalPages } = state.getScrapingState();
    if (currentPage < totalPages || hasNextPage()) {
      await navigateToNextPage(currentPage, totalPages, true);
    } else {
      // Scraping complete
      console.log("Scraping completed!");
      stopScraping();
      await storageApi.notifyScrapingComplete();
    }
  } catch (error) {
    console.error("Error during scraping:", error);
    stopScraping();
  }
}

// Stop scraping process
function stopScraping() {
  const state = window.LinkedInScraperState;
  if (state) {
    state.stopScrapingState();
  }
}

// Check if scraping should continue (after page load)
function checkContinueScraping() {
  const state = window.LinkedInScraperState;
  const pagination = window.LinkedInScraperPagination;
  const extractor = window.LinkedInScraperExtractor;
  const validator = window.LinkedInScraperValidator;
  const storageApi = window.LinkedInScraperStorageApi;
  const messageBridge = window.LinkedInScraperMessageBridge;

  if (!state || !pagination || !extractor || !validator || !storageApi) {
    console.error("Required modules not available");
    return;
  }

  // Critical: Check if scraping was stopped before proceeding
  if (state.isScrapingStopped()) {
    console.log("Scraping was stopped, aborting checkContinueScraping");
    return;
  }

  if (!state.checkShouldContinue()) {
    return;
  }

  if (!isValidPeopleSearchPage()) {
    return;
  }

  // Reinitialize message bridge after navigation to ensure STOP messages are received
  if (messageBridge) {
    messageBridge.initializeMessageBridge();
  }

  const { currentPage, totalPages } = state.restoreStateFromSession();
  console.log(`Continuing scraping: Page ${currentPage} of ${totalPages}`);

  // Continue scraping after page load delay
  state.setContinueTimeout(async () => {
    try {
      // Double-check if scraping is still active
      if (state.isScrapingStopped()) {
        console.log("Scraping was stopped during page load, aborting");
        return;
      }

      // Extract and process profiles
      const extractedProfiles = extractor.extractProfilesFromPage();
      const validatedProfiles = [];

      extractedProfiles.forEach((profileData) => {
        const validatedProfile = validator.createValidatedProfile(profileData);
        if (validatedProfile) {
          validatedProfiles.push(validatedProfile);
        }
      });

      if (validatedProfiles.length === 0) {
        console.warn(
          "No profiles found on current page - this might indicate selector issues"
        );
      }

      // Always save profiles
      await storageApi.saveProfiles(validatedProfiles);

      // Ensure paginator is active
      const { ensureNextButtonReady, hasNextPage, navigateToNextPage } =
        pagination;
      await ensureNextButtonReady();

      // Check again before navigating
      if (!state.isScrapingStopped()) {
        const { currentPage: current, totalPages: total } =
          state.getScrapingState();
        if (current < total || hasNextPage()) {
          await navigateToNextPage(current, total, true);
        } else {
          console.log("Scraping completed!");
          stopScraping();
          await storageApi.notifyScrapingComplete();
        }
      } else {
        console.log("Scraping was stopped, ending process");
        stopScraping();
      }
    } catch (error) {
      console.error("Error continuing scraping:", error);
      stopScraping();
    }
  }, 2000);
}

// Detect if we're on a valid people search page (moved from scraper.js)
function isValidPeopleSearchPage() {
  return (
    location.href.includes("linkedin.com/search/results/people/") ||
    location.href.includes("linkedin.com/search/results/people?") ||
    location.pathname.includes("/search/results/people/") ||
    (location.pathname.includes("/search/results/people") &&
      location.search.length > 0)
  );
}

// Export functions
window.LinkedInScraperController = {
  startScraping,
  stopScraping,
  checkContinueScraping,
  isValidPeopleSearchPage,
};

console.log("controller.js module loaded");
