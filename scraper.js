// Content Script for LinkedIn Profile Scraper
// Runs on LinkedIn people search pages to extract profile data

let isScrapingActive = false;
let currentPage = 1;
let totalPages = 1;
let scrapingInProgress = false;

// Utility functions
function extractProfileId(url) {
  if (!url) return null;
  const match = url.match(/\/in\/([^/?]+)/);
  return match ? match[1] : null;
}

function cleanProfileUrl(url) {
  if (!url) return null;
  const cleanUrl = url.split("?")[0]; // Remove query parameters
  return cleanUrl;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomDelay() {
  return Math.floor(Math.random() * 1000) + 500; // 500-1500ms
}

// Detect if we're on a valid people search page
function isValidPeopleSearchPage() {
  return (
    location.href.includes("linkedin.com/search/results/people/") ||
    location.href.includes("linkedin.com/search/results/people?")
  );
}

// Extract total page count from pagination
function getTotalPages() {
  try {
    // Updated selector for current LinkedIn structure
    const paginationSelectors = [
      "div.artdeco-pagination__page-state", // Current structure: "Page 2 of 6"
      ".artdeco-pagination__pages li:last-child button",
      ".artdeco-pagination__indicator--number:last-child",
    ];

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

// Extract profile data from current page
function scrapeCurrentPage() {
  try {
    const profiles = [];

    // Use structural and semantic selectors that are stable across LinkedIn updates
    const resultSelectors = [
      "main ul li", // Most direct approach - main search results
      "main div ul li", // One level deeper
      "main div div ul li", // Two levels deeper
      "main div div div ul li", // Three levels deeper
      "main div div div div ul li", // Four levels deeper (based on your XPath)
      "div[data-chameleon-result-urn] li", // Data attribute approach
      "li[data-chameleon-result-urn]", // Direct li with data attributes
      ".search-results-container li", // Fallback for older structure
    ];

    let searchResults = [];
    for (const selector of resultSelectors) {
      searchResults = document.querySelectorAll(selector);
      if (searchResults.length > 0) {
        console.log(`Found results using selector: ${selector}`);
        break;
      }
    }

    // If no results found with specific selectors, try broader search
    if (searchResults.length === 0) {
      console.log(
        "No results with primary selectors, trying broader search..."
      );
      // Look for any li that contains a LinkedIn profile link
      const allLis = document.querySelectorAll("li");
      const profileLis = Array.from(allLis).filter(
        (li) =>
          li.querySelector('a[href*="/in/"]') ||
          li.querySelector('a[href*="linkedin.com/in/"]')
      );
      searchResults = profileLis;
      if (searchResults.length > 0) {
        console.log(
          `Found ${searchResults.length} results using fallback profile link search`
        );
      }
    }

    console.log(
      `Found ${searchResults.length} profile results on page ${currentPage}`
    );

    searchResults.forEach((result, index) => {
      try {
        // Extract profile link using stable patterns (avoid dynamic classes in context)
        const profileLinkSelectors = [
          'a.mgFkhbNCAguTzbjLozeYRagsCtabmGnDJw[href*="/in/"]', // The class mgFkhbNCAguTzbjLozeYRagsCtabmGnDJw seems stable for profile links
          'div.mb1 a[href*="/in/"]', // Profile link within mb1 container (mb1 is semantic)
          'a[href*="/in/"]:not([href*="search"])', // Any /in/ link that's not a search link
          'a[href*="linkedin.com/in/"]',
        ];

        let profileLink = null;
        let profileName = "";

        for (const selector of profileLinkSelectors) {
          const linkElement = result.querySelector(selector);
          if (linkElement) {
            profileLink = linkElement.href;

            // Get name from the link element - based on exact structure from poststructure.html
            const nameSelectors = [
              'span[dir="ltr"] > span[aria-hidden="true"]', // Exact structure: <span dir="ltr"><span aria-hidden="true">Name</span>
              'span[dir="ltr"] span[aria-hidden="true"]', // Same but less strict
              'span > span[aria-hidden="true"]', // Direct child fallback
              'span span[aria-hidden="true"]', // General nested span
              'span[aria-hidden="true"]:not(.visually-hidden)', // Exclude visually-hidden spans
              'span[aria-hidden="true"]', // Broad fallback
            ];

            for (const nameSelector of nameSelectors) {
              const nameElement = linkElement.querySelector(nameSelector);
              if (nameElement && nameElement.textContent.trim()) {
                let extractedName = nameElement.textContent.trim();

                // Clean up HTML comments and normalize text
                extractedName = extractedName.replace(/<!---->/g, "").trim();

                // Filter out status-related text
                const statusPhrases = [
                  "Status is offline",
                  "Status is online",
                  "Online",
                  "Offline",
                  "Away",
                  "Busy",
                  "Last seen",
                  "Active now",
                ];

                const isStatusText = statusPhrases.some((phrase) =>
                  extractedName.toLowerCase().includes(phrase.toLowerCase())
                );

                // Validate that this looks like a real name (basic validation)
                const looksLikeName =
                  extractedName.length > 1 &&
                  extractedName.length < 100 &&
                  !isStatusText &&
                  /^[a-zA-Z\s\u00C0-\u017F\u0100-\u024F\u1E00-\u1EFF\u2000-\u206F\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F\u0370-\u03FF\u1F00-\u1FFF]+/.test(
                    extractedName
                  );

                if (looksLikeName) {
                  profileName = extractedName;
                  console.log(
                    `Found name using selector "${nameSelector}": "${profileName}"`
                  );
                  break;
                } else {
                  console.log(
                    `Rejected text "${extractedName}" from selector "${nameSelector}" (appears to be status or invalid)`
                  );
                }
              }
            }

            // Enhanced fallback: get text content directly from link but filter it
            if (!profileName && linkElement.textContent.trim()) {
              let fallbackText = linkElement.textContent.trim();
              // Try to extract just the name part from the full link text
              const lines = fallbackText
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line.length > 0);
              for (const line of lines) {
                const cleanLine = line.replace(/<!---->/g, "").trim();
                const statusPhrases = [
                  "Status is offline",
                  "Status is online",
                  "Online",
                  "Offline",
                  "Away",
                  "Busy",
                  "Last seen",
                  "Active now",
                ];
                const isStatusText = statusPhrases.some((phrase) =>
                  cleanLine.toLowerCase().includes(phrase.toLowerCase())
                );

                if (
                  cleanLine.length > 1 &&
                  cleanLine.length < 100 &&
                  !isStatusText &&
                  /^[a-zA-Z\s\u00C0-\u017F\u0100-\u024F\u1E00-\u1EFF\u2000-\u206F\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F\u0370-\u03FF\u1F00-\u1FFF]+/.test(
                    cleanLine
                  )
                ) {
                  profileName = cleanLine;
                  console.log(
                    `Found name using fallback text parsing: "${profileName}"`
                  );
                  break;
                }
              }
            }
            break;
          }
        }

        if (!profileLink) {
          console.warn(`No profile link found for result ${index + 1}`);
          // Debug: Log the actual HTML structure when no link is found
          console.log(
            "Debug - Result HTML:",
            result.outerHTML.substring(0, 500) + "..."
          );
          return;
        }

        // Debug: Log if we found a profile link but no name
        if (!profileName) {
          console.warn(
            `Profile link found but no name extracted for result ${index + 1}`
          );
          console.log(
            "Debug - Link element HTML:",
            linkElement.outerHTML.substring(0, 300) + "..."
          );
          console.log(
            "Debug - Link text content:",
            linkElement.textContent.substring(0, 200)
          );

          // Show all span elements within the link for debugging
          const allSpans = linkElement.querySelectorAll("span");
          console.log(
            `Debug - Found ${allSpans.length} span elements in link:`
          );
          allSpans.forEach((span, i) => {
            console.log(
              `  Span ${
                i + 1
              }: "${span.textContent.trim()}" | aria-hidden: ${span.getAttribute(
                "aria-hidden"
              )} | class: ${span.className}`
            );
          });
        }

        // Extract headline/title - use stable patterns with fallbacks
        const headlineSelectors = [
          ".IiwrdSaZAZYmlnxRtwjZyHnRkVqELimfgEMk.t-14.t-black.t-normal", // Hash class appears stable across samples
          "div.mb1 .IiwrdSaZAZYmlnxRtwjZyHnRkVqELimfgEMk", // With context
          "div.mb1 div.t-14.t-black.t-normal", // Semantic fallback
          "div.t-14.t-black.t-normal", // Direct semantic match
          'div[class*="t-14"][class*="t-black"][class*="t-normal"]', // Pattern matching
          ".entity-result__primary-subtitle", // Legacy fallback
        ];

        let headline = "";
        for (const selector of headlineSelectors) {
          const headlineElement = result.querySelector(selector);
          if (headlineElement && headlineElement.textContent.trim()) {
            headline = headlineElement.textContent.trim();
            break;
          }
        }

        // Extract location - use stable patterns with fallbacks
        const locationSelectors = [
          ".dYSmssFoeurfwRBkaSJKzhvqkVuxjhmxk.t-14.t-normal", // Hash class appears stable across samples
          "div.mb1 .dYSmssFoeurfwRBkaSJKzhvqkVuxjhmxk", // With context
          "div.mb1 div.t-14.t-normal:not(.t-black)", // Semantic fallback
          "div.t-14.t-normal:not(.t-black)", // Direct semantic match
          'div[class*="t-14"][class*="t-normal"]:not([class*="t-black"])', // Pattern matching
          ".entity-result__secondary-subtitle", // Legacy fallback
        ];

        let location = "";
        for (const selector of locationSelectors) {
          const locationElement = result.querySelector(selector);
          if (locationElement && locationElement.textContent.trim()) {
            location = locationElement.textContent.trim();
            break;
          }
        }

        // Clean and validate data
        const cleanUrl = cleanProfileUrl(profileLink);
        const profileId = extractProfileId(cleanUrl);

        if (profileId && profileName) {
          const profile = {
            id: profileId,
            name: profileName,
            url: cleanUrl,
            headline: headline,
            location: location,
            scrapedAt: Date.now(),
          };

          profiles.push(profile);
          console.log(`Scraped profile ${index + 1}:`, profile);
        } else {
          console.warn(`Invalid profile data for result ${index + 1}:`);
          console.log(`  Profile ID: "${profileId}"`);
          console.log(`  Profile Name: "${profileName}"`);
          console.log(`  Clean URL: "${cleanUrl}"`);
          console.log(`  Original URL: "${profileLink}"`);

          // Don't completely skip this profile - still try to save what we have if we have a URL
          if (cleanUrl && profileId) {
            const partialProfile = {
              id: profileId,
              name: profileName || "Unknown Name",
              url: cleanUrl,
              headline: headline,
              location: location,
              scrapedAt: Date.now(),
            };
            profiles.push(partialProfile);
            console.log(
              `Saved partial profile data for result ${index + 1}:`,
              partialProfile
            );
          }
        }
      } catch (error) {
        console.error(`Error scraping profile ${index + 1}:`, error);
      }
    });

    return profiles;
  } catch (error) {
    console.error("Error scraping current page:", error);
    return [];
  }
}

// Save profiles to background script
async function saveProfiles(profiles) {
  if (profiles.length === 0) return;

  try {
    const response = await chrome.runtime.sendMessage({
      type: "SAVE_PROFILES",
      data: profiles,
    });

    if (response.success) {
      console.log(
        `Saved ${response.saved} profiles. Total in DB: ${response.total}`
      );
    } else {
      console.error("Failed to save profiles:", response.error);
    }
  } catch (error) {
    console.error("Error saving profiles:", error);
  }
}

// Navigate to next page
async function navigateToNextPage() {
  try {
    // Check if scraping was stopped before navigation
    if (!isScrapingActive) {
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

    // Double-check if scraping is still active before navigating
    if (
      isScrapingActive &&
      sessionStorage.getItem("scraperActive") === "true"
    ) {
      location.href = url.toString();
    } else {
      console.log("Scraping stopped during delay, canceling navigation");
    }
  } catch (error) {
    console.error("Error navigating to next page:", error);
    stopScraping();
  }
}

// Start scraping process
async function startScraping() {
  if (scrapingInProgress) {
    console.log("Scraping already in progress");
    return;
  }

  if (!isValidPeopleSearchPage()) {
    console.error("Not on a valid people search page");
    return;
  }

  isScrapingActive = true;
  scrapingInProgress = true;

  try {
    // Get page info
    currentPage = getCurrentPage();
    totalPages = getTotalPages();

    console.log(`Starting scraping: Page ${currentPage} of ${totalPages}`);

    // Set session storage for persistence across page loads
    sessionStorage.setItem("scraperActive", "true");
    sessionStorage.setItem("scraperCurrentPage", currentPage.toString());
    sessionStorage.setItem("scraperTotalPages", totalPages.toString());

    // Scrape current page
    const profiles = scrapeCurrentPage();

    if (profiles.length === 0) {
      console.warn(
        "No profiles found on current page - this might indicate selector issues"
      );
      // Still save the empty array to trigger IndexedDB creation
      await saveProfiles([]);
    } else {
      await saveProfiles(profiles);
    }

    // Ensure paginator is active before deciding to stop (mainly for first page)
    await ensureNextButtonReady();

    // Navigate to next page if available
    if (currentPage < totalPages || hasNextPage()) {
      await navigateToNextPage();
    } else {
      // Scraping complete
      console.log("Scraping completed!");
      stopScraping();

      chrome.runtime.sendMessage({
        type: "SCRAPE_DONE",
      });
    }
  } catch (error) {
    console.error("Error during scraping:", error);
    stopScraping();
  }
}

// Stop scraping process
function stopScraping() {
  isScrapingActive = false;
  scrapingInProgress = false;

  // Clear session storage
  sessionStorage.removeItem("scraperActive");
  sessionStorage.removeItem("scraperCurrentPage");
  sessionStorage.removeItem("scraperTotalPages");

  console.log("Scraping stopped");
}

// Check if scraping should continue (after page load)
function checkContinueScraping() {
  const shouldContinue = sessionStorage.getItem("scraperActive") === "true";

  if (shouldContinue && isValidPeopleSearchPage()) {
    currentPage = parseInt(sessionStorage.getItem("scraperCurrentPage") || "1");
    totalPages = parseInt(sessionStorage.getItem("scraperTotalPages") || "1");

    // Set the active flags
    isScrapingActive = true;
    scrapingInProgress = true;

    console.log(`Continuing scraping: Page ${currentPage} of ${totalPages}`);

    // Wait for page to fully load, then continue
    setTimeout(async () => {
      try {
        // Double-check if scraping is still active
        if (
          !isScrapingActive ||
          sessionStorage.getItem("scraperActive") !== "true"
        ) {
          console.log("Scraping was stopped during page load, aborting");
          return;
        }

        const profiles = scrapeCurrentPage();

        if (profiles.length === 0) {
          console.warn(
            "No profiles found on current page - this might indicate selector issues"
          );
          await saveProfiles([]);
        } else {
          await saveProfiles(profiles);
        }

        // Ensure paginator is active before deciding to stop
        await ensureNextButtonReady();

        // Check again before navigating
        if (
          isScrapingActive &&
          sessionStorage.getItem("scraperActive") === "true"
        ) {
          if (currentPage < totalPages || hasNextPage()) {
            await navigateToNextPage();
          } else {
            console.log("Scraping completed!");
            stopScraping();

            chrome.runtime.sendMessage({
              type: "SCRAPE_DONE",
            });
          }
        } else {
          console.log("Scraping was stopped, ending process");
          stopScraping();
        }
      } catch (error) {
        console.error("Error continuing scraping:", error);
        stopScraping();
      }
    }, 2000); // Wait 2 seconds for page to stabilize
  }
}

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "START_SCRAPING":
      startScraping();
      sendResponse({ success: true });
      break;

    case "STOP_SCRAPING":
      stopScraping();
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ success: false, error: "Unknown message type" });
  }

  return true;
});

// Initialize when page loads
function init() {
  console.log("LinkedIn Profile Scraper content script loaded");
  console.log("Current URL:", location.href);
  console.log("Current pathname:", location.pathname);

  if (!isValidPeopleSearchPage()) {
    console.log("Not on a people search page, content script inactive");
    return;
  }

  console.log("On LinkedIn people search page, scraper ready");

  // Test selectors immediately to debug - try multiple structural approaches
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

  // Check if we should continue scraping from previous page
  checkContinueScraping();
}

// Wait for DOM to be ready, then initialize
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
