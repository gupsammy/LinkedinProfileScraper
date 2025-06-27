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
  return location.pathname.startsWith("/search/results/people");
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

// Get current page number from URL or pagination
function getCurrentPage() {
  try {
    const urlParams = new URLSearchParams(location.search);
    const pageParam = urlParams.get("page");
    if (pageParam) {
      return parseInt(pageParam);
    }

    // Try to find current page from the page state element
    const pageStateElement = document.querySelector("div.artdeco-pagination__page-state");
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

    // Updated selectors for current LinkedIn structure - try multiple approaches
    const resultSelectors = [
      "main ul li", // Main search results list items
      "div[data-chameleon-result-urn] li",
      ".search-results-container li",
      "ul.reusable-search__entity-result-list li", // Alternative structure
      "li[data-chameleon-result-urn]", // Direct li with data attributes
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
      console.log("No results with primary selectors, trying broader search...");
      // Look for any li that contains a LinkedIn profile link
      const allLis = document.querySelectorAll("li");
      const profileLis = Array.from(allLis).filter(li => 
        li.querySelector('a[href*="/in/"]') || li.querySelector('a[href*="linkedin.com/in/"]')
      );
      searchResults = profileLis;
      if (searchResults.length > 0) {
        console.log(`Found ${searchResults.length} results using fallback profile link search`);
      }
    }

    console.log(
      `Found ${searchResults.length} profile results on page ${currentPage}`
    );

    searchResults.forEach((result, index) => {
      try {
        // Extract profile link and name using updated selectors
        const profileLinkSelectors = [
          'a[href*="/in/"]', // Any link containing /in/
          'a.mgFkhbNCAguTzbjLozeYRagsCtabmGnDJw', // Current LinkedIn class
          'a[href*="linkedin.com/in/"]',
        ];

        let profileLink = null;
        let profileName = "";

        for (const selector of profileLinkSelectors) {
          const linkElement = result.querySelector(selector);
          if (linkElement) {
            profileLink = linkElement.href;

            // Get name from the link element
            const nameSelectors = [
              'span[dir="ltr"] span[aria-hidden="true"]', // Current structure
              'span[aria-hidden="true"]',
              '.visually-hidden',
            ];

            for (const nameSelector of nameSelectors) {
              const nameElement = linkElement.querySelector(nameSelector);
              if (nameElement && nameElement.textContent.trim()) {
                profileName = nameElement.textContent.trim();
                break;
              }
            }
            
            // Fallback: get text content directly from link
            if (!profileName && linkElement.textContent.trim()) {
              profileName = linkElement.textContent.trim();
            }
            break;
          }
        }

        if (!profileLink) {
          console.warn(`No profile link found for result ${index + 1}`);
          return;
        }

        // Extract headline/title using updated selectors
        const headlineSelectors = [
          '.IiwrdSaZAZYmlnxRtwjZyHnRkVqELimfgEMk.t-14.t-black.t-normal', // Current structure
          '.IiwrdSaZAZYmlnxRtwjZyHnRkVqELimfgEMk',
          'div[class*="t-14"][class*="t-black"][class*="t-normal"]',
          '.entity-result__primary-subtitle',
        ];

        let headline = "";
        for (const selector of headlineSelectors) {
          const headlineElement = result.querySelector(selector);
          if (headlineElement && headlineElement.textContent.trim()) {
            headline = headlineElement.textContent.trim();
            break;
          }
        }

        // Extract location using updated selectors
        const locationSelectors = [
          '.dYSmssFoeurfwRBkaSJKzhvqkVuxjhmxk.t-14.t-normal', // Current structure
          '.dYSmssFoeurfwRBkaSJKzhvqkVuxjhmxk',
          'div[class*="t-14"][class*="t-normal"]:not([class*="t-black"])',
          '.entity-result__secondary-subtitle',
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
          console.warn(`Invalid profile data for result ${index + 1}:`, {
            profileId,
            profileName,
            cleanUrl,
          });
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

    location.href = url.toString();
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
      console.warn("No profiles found on current page - this might indicate selector issues");
      // Still save the empty array to trigger IndexedDB creation
      await saveProfiles([]);
    } else {
      await saveProfiles(profiles);
    }

    // Navigate to next page if available
    if (currentPage < totalPages) {
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

    console.log(`Continuing scraping: Page ${currentPage} of ${totalPages}`);

    // Wait for page to fully load, then continue
    setTimeout(async () => {
      try {
        const profiles = scrapeCurrentPage();
        
        if (profiles.length === 0) {
          console.warn("No profiles found on current page - this might indicate selector issues");
          await saveProfiles([]);
        } else {
          await saveProfiles(profiles);
        }

        if (currentPage < totalPages) {
          await navigateToNextPage();
        } else {
          console.log("Scraping completed!");
          stopScraping();

          chrome.runtime.sendMessage({
            type: "SCRAPE_DONE",
          });
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
  
  // Test selectors immediately to debug
  const testResults = document.querySelectorAll("main ul li");
  console.log(`Debug: Found ${testResults.length} results using 'main ul li' selector`);
  
  const paginationElement = document.querySelector("div.artdeco-pagination__page-state");
  if (paginationElement) {
    console.log(`Debug: Pagination text: "${paginationElement.textContent.trim()}"`);
  } else {
    console.log("Debug: No pagination element found");
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
