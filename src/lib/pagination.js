// Pagination detection and navigation logic
// Extracted from scraper.js during modularization

// Extract total page count from pagination
function getTotalPages() {
  try {
    const { paginationSelectors } = (window.LinkedInScraper?.Selectors || window.LinkedInScraperSelectors) || {};
    if (!paginationSelectors) {
      console.error("Pagination selectors not available");
      return 1;
    }

    for (const selector of paginationSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent.trim();
        console.log(`Pagination text found: "${text}"`);

        // Try "Page X of Y" format (current LinkedIn structure)
        const pageMatch = text.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
        if (pageMatch) {
          console.log(`Total pages detected: ${pageMatch[2]}`);
          return parseInt(pageMatch[2]);
        }

        // Try pure number format (last page button)
        const numberMatch = text.match(/^(\d+)$/);
        if (numberMatch) {
          return parseInt(numberMatch[1]);
        }
      }
    }

    // Fallback: count pagination buttons
    const pageButtons = document.querySelectorAll(
      ".artdeco-pagination__indicator--number"
    );
    if (pageButtons.length > 0) {
      const lastButton = pageButtons[pageButtons.length - 1];
      const pageNum = parseInt(lastButton.textContent.trim());
      if (!isNaN(pageNum)) {
        return pageNum;
      }
    }

    console.log("Could not determine total pages, defaulting to 1");
    return 1; // Default to 1 page if we can't determine
  } catch (error) {
    console.error("Error getting total pages:", error);
    return 1;
  }
}

// Check if a clickable "Next" pagination button exists and is enabled
function hasNextPage() {
  try {
    // Look for span with exact text "Next" inside any button
    const candidates = Array.from(
      document.querySelectorAll("button span.artdeco-button__text")
    );

    for (const span of candidates) {
      if (span.textContent.trim().toLowerCase() === "next") {
        const btn = span.closest("button");
        if (btn) {
          const isDisabled =
            btn.disabled || btn.getAttribute("aria-disabled") === "true";
          return !isDisabled;
        }
      }
    }

    // Fallback: specific aria-label on the button itself
    const nextButton = document.querySelector('button[aria-label="Next"]');
    if (nextButton) {
      const isDisabled =
        nextButton.disabled ||
        nextButton.getAttribute("aria-disabled") === "true";
      return !isDisabled;
    }

    return false;
  } catch (_) {
    return false;
  }
}

// Scroll to bottom to trigger lazy-loading and activate pagination (mainly for first page)
async function ensureNextButtonReady(maxTries = 10) {
  const { sleep } = (window.LinkedInScraper?.Utils || window.LinkedInScraperUtils) || {};
  if (!sleep) {
    console.error("Sleep utility not available");
    return false;
  }

  for (let i = 0; i < maxTries; i++) {
    if (hasNextPage()) {
      console.log(`Next button became ready after ${i} scroll attempts`);
      return true;
    }
    console.log(`Scroll attempt ${i + 1} to activate pagination...`);
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    await sleep(800);
  }
  const finalCheck = hasNextPage();
  console.log(
    `Final pagination check after scrolling: ${
      finalCheck ? "ready" : "not ready"
    }`
  );
  return finalCheck;
}

// Get current page number from URL or pagination
function getCurrentPage() {
  try {
    const urlParams = new URLSearchParams(location.search);
    const pageParam = urlParams.get("page");
    if (pageParam) {
      return parseInt(pageParam);
    }

    // Try to find current page from the page state element
    const pageStateElement = document.querySelector(
      "div.artdeco-pagination__page-state"
    );
    if (pageStateElement) {
      const text = pageStateElement.textContent.trim();
      const pageMatch = text.match(/Page\s+(\d+)\s+of\s+\d+/i);
      if (pageMatch) {
        return parseInt(pageMatch[1]);
      }
    }

    // Try to find current page in pagination indicators
    const currentPageElement = document.querySelector(
      ".artdeco-pagination__indicator--current"
    );
    if (currentPageElement) {
      const pageNum = parseInt(currentPageElement.textContent.trim());
      if (!isNaN(pageNum)) {
        return pageNum;
      }
    }

    return 1; // Default to page 1
  } catch (error) {
    console.error("Error getting current page:", error);
    return 1;
  }
}

// Navigate to next page
async function navigateToNextPage(currentPage, totalPages, isScrapingActive) {
  try {
    const { sleep, getRandomDelay } = (window.LinkedInScraper?.Utils || window.LinkedInScraperUtils) || {};
    if (!sleep || !getRandomDelay) {
      console.error("Utility functions not available");
      return;
    }

    // Check if scraping was stopped before navigation
    if (
      !isScrapingActive ||
      sessionStorage.getItem("scraperStopped") === "true"
    ) {
      console.log("Scraping was stopped, canceling navigation");
      return;
    }

    const nextPage = currentPage + 1;
    const url = new URL(location.href);
    url.searchParams.set("page", nextPage);

    // Set flag to continue scraping on next page
    sessionStorage.setItem("scraperActive", "true");
    sessionStorage.setItem("scraperCurrentPage", nextPage.toString());
    sessionStorage.setItem("scraperTotalPages", totalPages.toString());

    console.log(`Navigating to page ${nextPage}...`);

    // Add random delay before navigation
    await sleep(getRandomDelay());

    // Final check before actual navigation
    if (
      isScrapingActive &&
      sessionStorage.getItem("scraperActive") === "true" &&
      sessionStorage.getItem("scraperStopped") !== "true"
    ) {
      location.href = url.toString();
    } else {
      console.log("Scraping stopped during delay, canceling navigation");
    }
  } catch (error) {
    console.error("Error navigating to next page:", error);
    // Stop scraping on navigation error like main branch
    const state = window.LinkedInScraper?.State || window.LinkedInScraperState;
    if (state) {
      state.stopScrapingState();
    }
  }
}

// Export functions using consolidated namespace
if (window.LinkedInScraper && window.LinkedInScraper.registerModule) {
  window.LinkedInScraper.registerModule('Pagination', {
    getTotalPages,
    hasNextPage,
    ensureNextButtonReady,
    getCurrentPage,
    navigateToNextPage
  });
} else {
  // Fallback for backward compatibility during transition
  window.LinkedInScraperPagination = {
    getTotalPages,
    hasNextPage,
    ensureNextButtonReady,
    getCurrentPage,
    navigateToNextPage
  };
}

console.log("pagination.js module loaded");
