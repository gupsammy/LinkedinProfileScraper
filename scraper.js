// Content Script for LinkedIn Profile Scraper
// Runs on LinkedIn people search pages to extract profile data

let isScrapingActive = false;
let currentPage = 1;
let totalPages = 1;
let scrapingInProgress = false;
let continueScrapingTimeout = null;

// Import utility functions from modular utils
// Utils will be available via window.LinkedInScraperUtils after utils.js loads
const { extractProfileId, cleanProfileUrl, sleep, getRandomDelay } = window.LinkedInScraperUtils || {};

// Import selectors from modular selectors
const { 
  resultSelectors, 
  profileLinkSelectors, 
  nameSelectors, 
  headlineSelectors, 
  locationSelectors 
} = window.LinkedInScraperSelectors || {};

// Import pagination functions from modular pagination
const { 
  getTotalPages, 
  hasNextPage, 
  ensureNextButtonReady, 
  getCurrentPage, 
  navigateToNextPage 
} = window.LinkedInScraperPagination || {};

// Detect if we're on a valid people search page
function isValidPeopleSearchPage() {
  return (
    location.href.includes("linkedin.com/search/results/people/") ||
    location.href.includes("linkedin.com/search/results/people?")
  );
}


// Extract profile data from current page
function scrapeCurrentPage() {
  try {
    const profiles = [];

    // Use modular selectors from selectors.js
    if (!resultSelectors) {
      console.error('Result selectors not available from selectors module');
      return [];
    }

    let searchResults = [];
    let searchResultsSelector = "";

    for (const selector of resultSelectors) {
      if (selector === "div[data-chameleon-result-urn]") {
        // Special handling - get parent li elements of profile data divs
        const profileDivs = document.querySelectorAll(selector);
        const parentLis = Array.from(profileDivs)
          .map((div) => div.closest("li"))
          .filter((li) => li);
        if (parentLis.length > 0) {
          searchResults = parentLis;
          searchResultsSelector = `${selector} (parent li)`;
          break;
        }
      } else {
        searchResults = document.querySelectorAll(selector);
        if (searchResults.length > 0) {
          searchResultsSelector = selector;
          break;
        }
      }
    }

    // If no results found with specific selectors, try broader search
    if (searchResults.length === 0) {
      console.log("No search results found on this page using any selector");
      return;
    }

    console.log(`Found results using selector: ${searchResultsSelector}`);
    console.log(
      `Found ${searchResults.length} profile results on page ${currentPage}`
    );

    searchResults.forEach((result, index) => {
      try {
        // Use modular profile link selectors from selectors.js
        if (!profileLinkSelectors) {
          console.error('Profile link selectors not available from selectors module');
          return;
        }

        let profileLink = null;
        let profileName = "";

        for (const selector of profileLinkSelectors) {
          const linkElements = result.querySelectorAll(selector); // Get ALL matching links, not just first

          for (const linkElement of linkElements) {
            if (linkElement && linkElement.href) {
              profileLink = linkElement.href; // Use this as the profile URL

              // Use modular name selectors from selectors.js
              if (!nameSelectors) {
                console.error('Name selectors not available from selectors module');
                continue;
              }

              for (const nameSelector of nameSelectors) {
                const nameElement = linkElement.querySelector(nameSelector);
                if (nameElement) {
                  let extractedName = "";

                  // Handle img alt attribute
                  if (
                    nameElement.tagName.toLowerCase() === "img" &&
                    nameElement.alt
                  ) {
                    extractedName = nameElement.alt.trim();
                  }
                  // Handle text content from spans
                  else if (
                    nameElement.textContent &&
                    nameElement.textContent.trim()
                  ) {
                    extractedName = nameElement.textContent
                      .trim()
                      .replace(/<!---->/g, "")
                      .trim();
                  }

                  if (extractedName) {
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
                      /^[a-zA-Z\s\u00C0-\u017F\u0100-\u024F\u1E00-\u1EFF\u2000-\u206F\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F\u0370-\u03FF\u1F00-\u1FFF()]+/.test(
                        extractedName
                      );

                    if (looksLikeName) {
                      profileName = extractedName;
                      console.log(
                        `Found name using selector "${nameSelector}": "${profileName}"`
                      );
                      break; // Break out of nameSelectors loop
                    } else {
                      console.log(
                        `Rejected text "${extractedName}" from selector "${nameSelector}" (appears to be status or invalid)`
                      );
                    }
                  }
                }
              }

              // If we found a name in this link, we're done
              if (profileName) {
                break; // Break out of linkElements loop
              }
            }
          }

          // If we found a profile link and name, we're done with all selectors
          if (profileLink && profileName) {
            break; // Break out of profileLinkSelectors loop
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

          // FINAL FALLBACK: Extract name from URL if all else fails
          if (profileLink) {
            try {
              const urlParts = profileLink
                .split("/in/")[1]
                ?.split("?")[0]
                ?.split("/")[0];
              if (urlParts && urlParts.length > 2) {
                // Convert LinkedIn URL slug to readable name (e.g., "john-doe-123" -> "John Doe")
                const nameFromUrl = urlParts
                  .replace(/-\d+$/, "") // Remove trailing numbers
                  .split("-")
                  .filter((part) => part.length > 1 && !/^\d+$/.test(part)) // Remove short parts and pure numbers
                  .map(
                    (word) =>
                      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                  )
                  .join(" ");

                if (nameFromUrl.length > 2) {
                  profileName = nameFromUrl;
                  console.log(`📝 Extracted name from URL: "${profileName}"`);
                }
              }
            } catch (error) {
              console.log("Failed to extract name from URL:", error);
            }
          }

          if (!profileName) {
            console.log(
              "Debug - Link element HTML:",
              linkElement
                ? linkElement.outerHTML.substring(0, 300) + "..."
                : "No link element"
            );
            console.log(
              "Debug - Link text content:",
              linkElement
                ? linkElement.textContent.substring(0, 200)
                : "No link element"
            );

            // Show all span elements within the link for debugging
            if (linkElement) {
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
          }
        }

        // Extract headline using modular selectors
        let headline = "";
        if (headlineSelectors) {
          for (const selector of headlineSelectors) {
            const headlineElement = result.querySelector(selector);
            if (headlineElement && headlineElement.textContent.trim()) {
              headline = headlineElement.textContent.trim();
              break;
            }
          }
        }

        // Extract location using modular selectors
        let location = "";
        if (locationSelectors) {
          for (const selector of locationSelectors) {
            const locationElement = result.querySelector(selector);
            if (locationElement && locationElement.textContent.trim()) {
              location = locationElement.textContent.trim();
              break;
            }
          }
        }

        // Clean and validate data
        const cleanUrl = cleanProfileUrl(profileLink);
        const profileId = extractProfileId(cleanUrl);

        // ROBUST EXTRACTION: Save profile as long as we have a valid URL and ID
        // Use fallback values for missing fields instead of skipping entire profile
        if (profileId && cleanUrl) {
          const profile = {
            id: profileId,
            name: profileName || "Name not available", // Fallback for missing name
            url: cleanUrl,
            headline: headline || "Headline not available", // Fallback for missing headline
            location: location || "Location not available", // Fallback for missing location
            scrapedAt: Date.now(),
          };

          profiles.push(profile);
          console.log(`Scraped profile ${index + 1}:`, profile);

          // Log what fields were missing for debugging
          const missingFields = [];
          if (!profileName) missingFields.push("name");
          if (!headline) missingFields.push("headline");
          if (!location) missingFields.push("location");

          if (missingFields.length > 0) {
            console.log(
              `  ⚠️  Missing fields: ${missingFields.join(
                ", "
              )} - using fallback values`
            );
          }
        } else {
          // Only skip if we don't have essential data (URL/ID)
          console.error(
            `❌ Cannot save profile ${index + 1} - missing essential data:`
          );
          console.log(`  Profile ID: "${profileId}"`);
          console.log(`  Clean URL: "${cleanUrl}"`);
          console.log(`  Original URL: "${profileLink}"`);

          // Still log what we found for debugging
          if (profileName) console.log(`  Found name: "${profileName}"`);
          if (headline) console.log(`  Found headline: "${headline}"`);
          if (location) console.log(`  Found location: "${location}"`);
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
  try {
    const response = await chrome.runtime.sendMessage({
      type: "SAVE_PROFILES",
      data: profiles || [],
    });

    if (response && response.success) {
      if (profiles && profiles.length > 0) {
        console.log(
          `Saved ${response.saved} profiles. Total in DB: ${response.total}`
        );
      } else {
        console.log(
          `No profiles to save, but database initialized. Total in DB: ${response.total}`
        );
      }
    } else {
      const errorMessage = response?.error || "Unknown error occurred";
      console.error("Failed to save profiles:", errorMessage);
    }
  } catch (error) {
    console.error("Error saving profiles:", error);
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

    // Clear any previous stop flag and set session storage for persistence
    sessionStorage.removeItem("scraperStopped");
    sessionStorage.setItem("scraperActive", "true");
    sessionStorage.setItem("scraperCurrentPage", currentPage.toString());
    sessionStorage.setItem("scraperTotalPages", totalPages.toString());

    // Scrape current page
    const profiles = scrapeCurrentPage();

    if (profiles.length === 0) {
      console.warn(
        "No profiles found on current page - this might indicate selector issues"
      );
    }
    // Always save profiles (empty or not) to ensure database initialization
    await saveProfiles(profiles);

    // Ensure paginator is active before deciding to stop (mainly for first page)
    await ensureNextButtonReady();

    // Navigate to next page if available
    if (currentPage < totalPages || hasNextPage()) {
      await navigateToNextPage(currentPage, totalPages, isScrapingActive);
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

  // Clear any ongoing timeouts
  if (continueScrapingTimeout) {
    clearTimeout(continueScrapingTimeout);
    continueScrapingTimeout = null;
  }

  // Clear session storage and set stop flag
  sessionStorage.removeItem("scraperActive");
  sessionStorage.removeItem("scraperCurrentPage");
  sessionStorage.removeItem("scraperTotalPages");
  sessionStorage.setItem("scraperStopped", "true");

  console.log("Scraping stopped");
}

// Check if scraping should continue (after page load)
function checkContinueScraping() {
  const wasStopped = sessionStorage.getItem("scraperStopped") === "true";
  if (wasStopped) {
    console.log("Scraping was previously stopped, not resuming");
    return;
  }

  const shouldContinue = sessionStorage.getItem("scraperActive") === "true";

  if (shouldContinue && isValidPeopleSearchPage()) {
    currentPage = parseInt(sessionStorage.getItem("scraperCurrentPage") || "1");
    totalPages = parseInt(sessionStorage.getItem("scraperTotalPages") || "1");

    // Set the active flags
    isScrapingActive = true;
    scrapingInProgress = true;

    console.log(`Continuing scraping: Page ${currentPage} of ${totalPages}`);

    // Clear any existing timeout
    if (continueScrapingTimeout) {
      clearTimeout(continueScrapingTimeout);
    }

    // Wait for page to fully load, then continue
    continueScrapingTimeout = setTimeout(async () => {
      try {
        // Double-check if scraping is still active and not stopped
        if (
          !isScrapingActive ||
          sessionStorage.getItem("scraperActive") !== "true" ||
          sessionStorage.getItem("scraperStopped") === "true"
        ) {
          console.log("Scraping was stopped during page load, aborting");
          return;
        }

        const profiles = scrapeCurrentPage();

        if (profiles.length === 0) {
          console.warn(
            "No profiles found on current page - this might indicate selector issues"
          );
        }
        // Always save profiles (empty or not) to ensure database initialization
        await saveProfiles(profiles);

        // Ensure paginator is active before deciding to stop
        await ensureNextButtonReady();

        // Check again before navigating
        if (
          isScrapingActive &&
          sessionStorage.getItem("scraperActive") === "true" &&
          sessionStorage.getItem("scraperStopped") !== "true"
        ) {
          if (currentPage < totalPages || hasNextPage()) {
            await navigateToNextPage(currentPage, totalPages, isScrapingActive);
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
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
