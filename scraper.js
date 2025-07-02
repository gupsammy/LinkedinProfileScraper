// Content Script for LinkedIn Profile Scraper
// Runs on LinkedIn people search pages to extract profile data

let isScrapingActive = false;
let currentPage = 1;
let totalPages = 1; // Will be set to null if detection fails critically
let scrapingInProgress = false;
let consecutiveEmptyPages = 0; // Counter for consecutive pages with no profiles found
const MAX_CONSECUTIVE_EMPTY_PAGES = 3; // Threshold to stop if no profiles are found

// --- Global Error Handlers ---
window.addEventListener('error', function(event) {
    console.error('[LinkedInScraper] Unhandled error in content script:', event.error || event.message);
    // Consider stopping scraping or notifying background script if appropriate
    // stopScraping();
    // chrome.runtime.sendMessage({ type: "CONTENT_SCRIPT_ERROR", error: event.message });
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('[LinkedInScraper] Unhandled promise rejection in content script:', event.reason);
    // stopScraping();
    // chrome.runtime.sendMessage({ type: "CONTENT_SCRIPT_PROMISE_ERROR", error: event.reason });
});

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

    console.warn("[LinkedInScraper] Could not determine total pages from selectors. Returning null.");
    return null; // Return null if no method succeeds
  } catch (error) {
    console.error("[LinkedInScraper] Error getting total pages:", error);
    return null; // Return null on error
  }
}

// Check if a clickable "Next" pagination button exists and is enabled
function hasNextPage() {
  try {
    // PRIORITIZE ARIA-LABEL (more stable)
    const nextButtonAria = document.querySelector('button[aria-label*="Next" i], button[aria-label*="next page" i]');
    if (nextButtonAria) {
      const isDisabled = nextButtonAria.disabled || nextButtonAria.getAttribute("aria-disabled") === "true";
      if (!isDisabled) console.log("[LinkedInScraper] Next button found via ARIA label.");
      return !isDisabled;
    }

    // Fallback: Look for span with exact text "Next" inside any button (less stable due to class)
    // TODO: Make this selector more robust, e.g. by looking for buttons in a pagination landmark
    const candidates = Array.from(
      document.querySelectorAll("button span.artdeco-button__text") // artdeco-button__text is a style class
    );

    for (const span of candidates) {
      if (span.textContent.trim().toLowerCase() === "next") {
        const btn = span.closest("button");
        if (btn) {
          const isDisabled =
            btn.disabled || btn.getAttribute("aria-disabled") === "true";
          if(!isDisabled) console.log("[LinkedInScraper] Next button found via text content.");
          return !isDisabled;
        }
      }
    }
    console.log("[LinkedInScraper] No enabled 'Next' button found.");
    return false;
  } catch (error) {
    console.error("[LinkedInScraper] Error in hasNextPage:", error);
    return false;
  }
}

// Scroll to bottom to trigger lazy-loading and activate pagination
async function ensureNextButtonReady(maxTries = 5, scrollDelay = 1000, checkDelay = 500) {
  // Try without scrolling first
  if (hasNextPage()) {
    console.log("[LinkedInScraper] Next button is already available.");
    return true;
  }

  for (let i = 0; i < maxTries; i++) {
    console.log(`[LinkedInScraper] Scroll attempt ${i + 1} of ${maxTries} to activate pagination...`);
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    await sleep(scrollDelay); // Wait for scroll and potential lazy loading

    if (hasNextPage()) {
      console.log(`[LinkedInScraper] Next button became ready after ${i + 1} scroll attempts.`);
      return true;
    }
    await sleep(checkDelay); // Additional small delay before next check/scroll
  }

  const finalCheck = hasNextPage();
  if (finalCheck) {
    console.log("[LinkedInScraper] Next button became ready after final check.");
  } else {
    console.warn("[LinkedInScraper] Next button not ready after all scroll attempts.");
  }
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

    // Robust selectors for profile list items
    // TRY THESE FIRST (More Stable):
    // 1. Look for a list with an ARIA label like "Search results"
    //    e.g., 'ul[aria-label*="Search results"] > li', 'ol[aria-label*="Search results"] > li'
    // 2. Look for items with a specific data-testid if LinkedIn provides them for results.
    //    e.g., 'li[data-testid="search-result"]'
    // 3. Look for list items containing a profile URN if available
    //    e.g., 'li[data-result-urn*="linkedin:person:"]' (example URN)
    //
    // FALLBACKS (Less Stable):
    // 4. The data-chameleon-result-urn (if it proves to be somewhat stable)
    //    e.g., 'li[data-chameleon-result-urn]'
    // 5. Broad structural selectors (use with caution, verify they don't pick up other LIs)
    //    e.g., 'main ul.reusable-search__entity-result-list > li', 'div.search-results-container ul > li'
    //
    // CURRENT STRATEGY (very generic, high risk of selecting wrong items if page structure changes slightly):
    const resultSelectors = [
      // TODO: Prioritize with more specific, semantic selectors based on actual LinkedIn DOM inspection.
      // Example of a more semantic (but still needs verification) approach:
      // 'ul[aria-label*="Search results"] > li.search-result', // Hypothetical more semantic selector
      'li[data-chameleon-result-urn]', // If this data attribute is stable
      "main ul li", // Most direct approach - main search results (very generic)
      // ".search-results-container li", // Fallback for older structure (class-based, can break)
    ];

    let searchResults = [];
    for (const selector of resultSelectors) {
      searchResults = Array.from(document.querySelectorAll(selector)).filter(li => {
        // Ensure the li element contains a plausible profile link to qualify as a search result item
        return li.querySelector('a[href*="/in/"]:not([href*="search"])');
      });
      if (searchResults.length > 0) {
        console.log(`Found ${searchResults.length} potential results using base selector: ${selector} and link filtering`);
        break;
      }
    }

    if (searchResults.length === 0) {
         console.warn("No search result items found after trying all selectors or filtering. Page structure may have changed significantly.");
    }


    console.log(
      `Found ${searchResults.length} profile results on page ${currentPage}`
    );

    searchResults.forEach((result, index) => {
      try {
        // Extract profile link using stable patterns
        // PRIORITIZE THIS:
        let linkElement = result.querySelector('a[href*="/in/"]:not([href*="search"])');

        // Fallback (less ideal, as 'div.mb1' is a layout class):
        if (!linkElement) {
            linkElement = result.querySelector('div.mb1 a[href*="/in/"]');
        }
        // Fallback (even less ideal, as it's very broad):
        if (!linkElement) {
            linkElement = result.querySelector('a[href*="linkedin.com/in/"]');
        }

        // The obfuscated class 'a.mgFkhbNCAguTzbjLozeYRagsCtabmGnDJw[href*="/in/"]' was removed as it's too fragile.

        let profileLink = null;
        let profileName = "";

        if (linkElement) {
            profileLink = linkElement.href;

            // Get name from the link element
            // STRATEGY:
            // 1. Look for a span inside the link that is NOT aria-hidden (or has no aria-hidden).
            // 2. Look for a heading (h1-h6) inside the link or as a direct child of the result item.
            // 3. Fallback to the linkElement's textContent directly.
            // Avoid selectors like 'span[aria-hidden="true"]' for the main name if possible.

            let nameElement = linkElement.querySelector('span:not([aria-hidden="true"]):not([class*="visually-hidden"])'); // Prefer visible spans
            if (!nameElement || !nameElement.textContent.trim()) {
                 // Try to find a heading element associated with the link or result item
                 nameElement = result.querySelector('h1, h2, h3, h4, h5, h6') || linkElement.querySelector('h1, h2, h3, h4, h5, h6');
            }
            if (nameElement && nameElement.textContent.trim()) {
                profileName = nameElement.textContent.trim();
            } else {
                 // Fallback to the link's direct text content if specific name elements aren't found
                 profileName = linkElement.textContent.trim();
            }

            // Clean and validate the extracted name
            if (profileName) {
                profileName = profileName.replace(/<!---->/g, "").trim(); // Clean comments
                const statusPhrases = [
                    "Status is offline", "Status is online", "Online", "Offline",
                    "Away", "Busy", "Last seen", "Active now",
                    "Connect", "Follow", "Message", // Filter out button texts if link text is broad
                    "1st", "2nd", "3rd", // Filter out degree indicators
                    "View profile" // Common link text that isn't the name
                ];
                const lowerProfileName = profileName.toLowerCase();
                const isLikelyNoise = statusPhrases.some(phrase => lowerProfileName.includes(phrase.toLowerCase()));

                // Basic name validation (can be improved)
                // Attempt to extract the most plausible name from multi-line text content often found in links
                const lines = profileName.split('\n').map(line => line.trim()).filter(line => line.length > 1 && line.length < 100);
                let potentialName = "";
                for (const line of lines) {
                    const isLineNoise = statusPhrases.some(phrase => line.toLowerCase().includes(phrase.toLowerCase()));
                    const looksLikeNameRegEx = /^[a-zA-Z\s\u00C0-\u017F\u0100-\u024F\u1E00-\u1EFF\u2000-\u206F\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F\u0370-\u03FF\u1F00-\u1FFF\.\-']+$/;
                    if (!isLineNoise && looksLikeNameRegEx.test(line)) {
                        potentialName = line;
                        break; // Take the first plausible line
                    }
                }
                profileName = potentialName; // Use the filtered line or stick with original if no better line found

                if (!profileName || isLikelyNoise && !potentialName) { // If still noisy or empty after filtering
                    console.log(`Extracted text "${linkElement.textContent.trim()}" for name seems noisy or invalid, attempting more specific search.`);
                    profileName = ""; // Reset if initial extraction is poor
                }

                if (profileName) {
                     console.log(`Found name: "${profileName}"`);
                }
            }
        }


        if (!profileLink) {
          console.warn(`No profile link found for result ${index + 1} using robust selectors.`);
          console.log( "Debug - Result HTML (when no link found):", result.outerHTML.substring(0, 500) + "...");
          return; // Skip this profile if no link
        }

        // If profileName is still not found, try more specific patterns (less reliant on aria-hidden="true")
        if (linkElement && !profileName) {
            const nameCandSelectors = [
                'span[aria-hidden="false"]', // Explicitly not hidden
                'span:not([aria-hidden])',   // No aria-hidden attribute
                // Check for common LinkedIn patterns for names if direct text is noisy
                // e.g. a span that is the first significant text node, or one with specific typography if stable classes are found
            ];
            for (const sel of nameCandSelectors) {
                const el = linkElement.querySelector(sel);
                if (el && el.textContent && el.textContent.trim().length > 1) {
                    let tempName = el.textContent.trim().replace(/<!---->/g, "").trim();
                    // Add validation similar to 'looksLikeName' if needed
                     const statusPhrases = [
                        "Status is offline", "Status is online", "Online", "Offline", "Away", "Busy", "Last seen", "Active now",
                        "Connect", "Follow", "Message", "1st", "2nd", "3rd", "View profile"
                    ];
                    const isStillNoise = statusPhrases.some(phrase => tempName.toLowerCase().includes(phrase.toLowerCase()));
                    const looksLikeNameRegEx = /^[a-zA-Z\s\u00C0-\u017F\u0100-\u024F\u1E00-\u1EFF\u2000-\u206F\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F\u0370-\u03FF\u1F00-\u1FFF\.\-']+$/;

                    if (!isStillNoise && looksLikeNameRegEx.test(tempName)) {
                        profileName = tempName;
                        console.log(`Found name using fallback selector "${sel}": "${profileName}"`);
                        break;
                    }
                }
            }
        }


        // Debug: Log if we found a profile link but no name
        if (!profileName) {
          console.warn(`Profile link found but no name extracted for result ${index + 1}: ${profileLink}`);
          // Log details of the linkElement to help debug name extraction
          if (linkElement) {
            console.log("Debug - Link element HTML (when no name extracted):", linkElement.outerHTML.substring(0, 300) + "...");
            console.log("Debug - Link text content (when no name extracted):", linkElement.textContent.substring(0, 200));
            const allSpans = linkElement.querySelectorAll("span");
            console.log(`Debug - Found ${allSpans.length} span elements in link:`);
            allSpans.forEach((span, i) => {
                console.log(`  Span ${i + 1}: "${span.textContent.trim()}" | aria-hidden: ${span.getAttribute("aria-hidden")} | class: ${span.className}`);
            });
          }
        }

        // Extract headline/title - use stable patterns with fallbacks
        // REMOVED obfuscated classes. Rely on semantic classes or relative position.
        // TODO: Inspect LinkedIn DOM for stable headline selectors.
        // Possible strategies:
        // 1. Element with class like "entity-result__primary-subtitle" or "search-result__primary-subtitle"
        // 2. A 'div' or 'p' that is a sibling or near-sibling to the element containing the name/link.
        // 3. Text pattern matching if direct selectors are unreliable.
        const headlineSelectors = [
          ".entity-result__primary-subtitle", // Legacy fallback, check if still used or has new equivalent
          // Example: 'div[class*="job-title"]', 'p[class*="headline"]' (these are hypothetical)
          // Fallback: Find text node sibling/near-sibling of name element container.
          // For now, keeping it simple and expecting a common semantic class:
          'div[class*="primary-subtitle"]',
          'div[class*="headline"]',
          // Broader search within the result item for text that looks like a headline
        ];

        let headline = "";
        for (const selector of headlineSelectors) {
          const headlineElement = result.querySelector(selector);
          if (headlineElement && headlineElement.textContent.trim()) {
            headline = headlineElement.textContent.trim();
            break;
          }
        }
        // If no headline from selectors, try to find it contextually if profileName was found
        if (!headline && profileName) {
            const parentOfName = linkElement ? linkElement.closest('div') : result; // Or a more specific parent
            if (parentOfName) {
                const potentialHeadlines = Array.from(parentOfName.querySelectorAll('div, p, span'));
                for(const el of potentialHeadlines) {
                    const text = el.textContent.trim();
                    // Avoid re-picking the name, and check if it looks like a headline
                    if (text && text !== profileName && text.length > 5 && text.length < 200 && !el.closest('a')) {
                        // Add more headline-specific keywords or patterns if needed
                        headline = text;
                        console.log("Found headline contextually:", headline);
                        break;
                    }
                }
            }
        }


        // Extract location - use stable patterns with fallbacks
        // REMOVED obfuscated classes.
        // TODO: Inspect LinkedIn DOM for stable location selectors.
        // Strategies similar to headline.
        const locationSelectors = [
          ".entity-result__secondary-subtitle", // Legacy fallback
          // Example: 'div[class*="location"]', 'li[class*="location-item"]' (hypothetical)
          'div[class*="secondary-subtitle"]',
          'span[class*="location"]',
        ];

        let location = "";
        for (const selector of locationSelectors) {
          const locationElement = result.querySelector(selector);
          if (locationElement && locationElement.textContent.trim()) {
            location = locationElement.textContent.trim();
            break;
          }
        }
         // If no location from selectors, try to find it contextually
        if (!location && profileName) {
            const parentOfName = linkElement ? linkElement.closest('div') : result;
             if (parentOfName) {
                const potentialLocations = Array.from(parentOfName.querySelectorAll('div, p, span'));
                for(const el of potentialLocations) {
                    const text = el.textContent.trim();
                    // Avoid re-picking name or headline
                    if (text && text !== profileName && text !== headline && text.length > 3 && text.length < 100 && !el.closest('a')) {
                        // Add more location-specific keywords (e.g., city names, country names, "Area")
                        // This is a very basic check, real location detection needs more specific patterns
                         if (text.match(/([A-Za-z]+(?: [A-Za-z]+)*),\s*([A-Za-z]+(?: [A-Za-z]+)*)/) || text.match(/Area|Region/i)) {
                            location = text;
                            console.log("Found location contextually:", location);
                            break;
                        }
                    }
                }
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
  // No need to save if profiles array is empty, unless for specific DB init reasons not detailed.
  // For now, we only save if there's actual data.
  if (!profiles || profiles.length === 0) {
    console.log("[LinkedInScraper] No profiles to save for this page.");
    return { success: true, saved: 0, total: await getProfileCountFromBackground() }; // Indicate success with 0 saved
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: "SAVE_PROFILES",
      data: profiles,
    });

    if (response && response.success) {
      console.log(`[LinkedInScraper] Saved ${response.saved} profiles. Total in DB: ${response.total}`);
      return response;
    } else {
      console.error("[LinkedInScraper] Failed to save profiles:", response ? response.error : "No response");
      // Consider if this failure should stop the entire scraping process
      // For now, it just logs and continues.
      return { success: false, error: response ? response.error : "No response from background script during save." };
    }
  } catch (error) {
    console.error("[LinkedInScraper] Error sending profiles to background:", error);
    // This could happen if the background script is unavailable.
    return { success: false, error: error.message };
  }
}

async function getProfileCountFromBackground() {
    try {
        const response = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
        return response && response.success ? response.profileCount : 0;
    } catch (e) {
        console.error("[LinkedInScraper] Could not get profile count from background", e);
        return 0;
    }
}


// Navigate to next page
async function navigateToNextPage() {
  try {
    if (!isScrapingActive) {
      console.log("[LinkedInScraper] Scraping was stopped, canceling navigation.");
      return false; // Indicate navigation was cancelled
    }

    const nextPageNum = currentPage + 1;
    const url = new URL(location.href);
    url.searchParams.set("page", nextPageNum);

    // Update session storage for persistence across page loads
    sessionStorage.setItem("scraperActive", "true");
    sessionStorage.setItem("scraperCurrentPage", nextPageNum.toString());
    if (totalPages !== null) { // Only save totalPages if it's known
        sessionStorage.setItem("scraperTotalPages", totalPages.toString());
    } else {
        sessionStorage.removeItem("scraperTotalPages"); // Ensure it's not using an old value
    }


    console.log(`[LinkedInScraper] Navigating to page ${nextPageNum}...`);
    await sleep(getRandomDelay()); // Random delay before navigation

    if (isScrapingActive && sessionStorage.getItem("scraperActive") === "true") {
      location.href = url.toString();
      return true; // Indicate navigation initiated
    } else {
      console.log("[LinkedInScraper] Scraping stopped during delay, canceling navigation.");
      return false; // Indicate navigation was cancelled
    }
  } catch (error) {
    console.error("[LinkedInScraper] Error navigating to next page:", error);
    stopScraping("Error during navigation: " + error.message);
    return false; // Indicate navigation failed
  }
}

// Core scraping function for a single page
async function processCurrentPage() {
    console.log(`[LinkedInScraper] Processing page ${currentPage}. Total pages known: ${totalPages === null ? 'Unknown' : totalPages}`);
    const profiles = scrapeCurrentPage();

    if (profiles.length === 0) {
        console.warn("[LinkedInScraper] No profiles found on current page. This might indicate selector issues or end of results.");
        consecutiveEmptyPages++;
        if (consecutiveEmptyPages >= MAX_CONSECUTIVE_EMPTY_PAGES) {
            const errMsg = `Scraping stopped: No profiles found for ${consecutiveEmptyPages} consecutive pages. Selectors may be broken or it's the end of relevant results.`;
            console.error(`[LinkedInScraper] ${errMsg}`);
            stopScraping(errMsg, true); // true to notify background of failure
            return false; // Stop processing
        }
    } else {
        consecutiveEmptyPages = 0; // Reset if profiles are found
    }

    const saveResult = await saveProfiles(profiles);
    if (!saveResult.success) {
        // Decide if a save failure is critical enough to stop. For now, log and continue.
        console.error("[LinkedInScraper] Failed to save profiles for this page. Continuing for now.", saveResult.error);
        // stopScraping("Failed to save profiles: " + saveResult.error, true);
        // return false; // Optionally stop if saving is critical
    }
    return true; // Continue processing
}


// Start scraping process (called by message from popup or background)
async function startScraping(initialResponseCallback) {
  if (scrapingInProgress) {
    console.log("[LinkedInScraper] Scraping already in progress.");
    if (initialResponseCallback) initialResponseCallback({ success: true, message: "Already in progress" });
    return;
  }

  if (!isValidPeopleSearchPage()) {
    const errorMsg = "[LinkedInScraper] Not on a valid LinkedIn people search page.";
    console.error(errorMsg);
    if (initialResponseCallback) initialResponseCallback({ success: false, error: errorMsg });
    return;
  }

  console.log("[LinkedInScraper] Initiating scraping process...");
  isScrapingActive = true;
  scrapingInProgress = true;
  consecutiveEmptyPages = 0; // Reset counter at the start of a new scraping session

  try {
    currentPage = getCurrentPage(); // Get current page number first
    totalPages = getTotalPages();   // Try to get total pages

    if (totalPages === null) {
        console.warn("[LinkedInScraper] Could not determine total number of pages. Will proceed page by page using 'Next' button.");
        // No explicit totalPages in session storage if unknown
        sessionStorage.removeItem("scraperTotalPages");
    } else {
        sessionStorage.setItem("scraperTotalPages", totalPages.toString());
    }

    sessionStorage.setItem("scraperActive", "true");
    sessionStorage.setItem("scraperCurrentPage", currentPage.toString());

    if (initialResponseCallback) initialResponseCallback({ success: true, message: "Scraping started." });

    if (!await processCurrentPage()) return; // processCurrentPage will call stopScraping on critical failure

    // Navigation decision
    const canGoNext = await ensureNextButtonReady(); // Check if next button is available and ready

    // Condition to continue:
    // 1. If totalPages is known: currentPage < totalPages AND a next button exists/can be made ready
    // 2. If totalPages is unknown: a next button exists/can be made ready
    let shouldNavigate = false;
    if (totalPages !== null) { // We know the total number of pages
        if (currentPage < totalPages && canGoNext) {
            shouldNavigate = true;
        } else {
            console.log(`[LinkedInScraper] Reached page ${currentPage} of ${totalPages} or no next button.`)
        }
    } else { // We don't know the total number of pages
        if (canGoNext) {
            shouldNavigate = true;
        } else {
             console.log("[LinkedInScraper] Total pages unknown and no next button found.");
        }
    }

    if (isScrapingActive && shouldNavigate) {
      await navigateToNextPage();
    } else if (isScrapingActive) { // Scraping is active but we shouldn't navigate
      const completionMsg = totalPages !== null && currentPage >= totalPages ?
          `Completed all ${totalPages} pages.` :
          "No further pages to scrape or 'Next' button not available.";
      console.log(`[LinkedInScraper] ${completionMsg}`);
      stopScraping(completionMsg, false); // false because it's a normal completion or expected stop
    }
    // If !isScrapingActive, stopScraping() was already called.

  } catch (error) {
    console.error("[LinkedInScraper] Error during scraping process:", error);
    stopScraping("Runtime error during scraping: " + error.message, true);
  }
}

// Stop scraping process
function stopScraping(reason = "Scraping process stopped.", notifyFailure = false) {
  if (!isScrapingActive && !scrapingInProgress) { // Avoid redundant stops
    console.log("[LinkedInScraper] Stop scraping called, but already inactive.");
    return;
  }

  console.log(`[LinkedInScraper] ${reason}`);
  isScrapingActive = false;
  scrapingInProgress = false;

  sessionStorage.removeItem("scraperActive");
  sessionStorage.removeItem("scraperCurrentPage");
  sessionStorage.removeItem("scraperTotalPages");

  if (notifyFailure) {
      chrome.runtime.sendMessage({ type: "SCRAPE_FAILED", error: reason });
  } else if (reason.startsWith("Completed all") || reason.startsWith("No further pages")) { // Normal completion
      chrome.runtime.sendMessage({ type: "SCRAPE_DONE", message: reason });
  }
  // If just stopped by user, no specific message needed beyond the console log.
}

// Check if scraping should continue (after page load)
function checkContinueScraping() {
  const shouldContinue = sessionStorage.getItem("scraperActive") === "true";

  if (shouldContinue && isValidPeopleSearchPage()) {
    currentPage = parseInt(sessionStorage.getItem("scraperCurrentPage") || "1");
    const totalPagesStr = sessionStorage.getItem("scraperTotalPages");
    totalPages = totalPagesStr ? parseInt(totalPagesStr) : null; // Allow totalPages to be null if unknown


    isScrapingActive = true;
    scrapingInProgress = true; // Mark as in progress if continuing
    consecutiveEmptyPages = parseInt(sessionStorage.getItem("scraperConsecutiveEmpty") || "0"); // Persist this too

    console.log(`[LinkedInScraper] Continuing scraping: Page ${currentPage} of ${totalPages === null ? 'Unknown' : totalPages}`);

    // Reduced delay, relying more on DOM readiness for actual scraping elements.
    // Consider using MutationObserver for specific elements if this is still flaky.
    setTimeout(async () => {
      try {
        if (!isScrapingActive || sessionStorage.getItem("scraperActive") !== "true") {
          console.log("[LinkedInScraper] Scraping was stopped during page load/delay, aborting continuation.");
          if (scrapingInProgress) stopScraping("Stopped during page load continuation."); // Ensure cleanup if it was marked as inProgress
          return;
        }

        if (!await processCurrentPage()) return; // processCurrentPage will call stopScraping on critical failure

        // Navigation decision (similar to startScraping)
        const canGoNext = await ensureNextButtonReady();

        let shouldNavigate = false;
        if (totalPages !== null) {
            if (currentPage < totalPages && canGoNext) {
                shouldNavigate = true;
            } else {
                 console.log(`[LinkedInScraper] Reached page ${currentPage} of ${totalPages} or no next button during continuation.`)
            }
        } else {
            if (canGoNext) {
                shouldNavigate = true;
            } else {
                console.log("[LinkedInScraper] Total pages unknown and no next button found during continuation.");
            }
        }

        if (isScrapingActive && shouldNavigate) {
          await navigateToNextPage();
        } else if (isScrapingActive) {
          const completionMsg = totalPages !== null && currentPage >= totalPages ?
              `Completed all ${totalPages} pages.` :
              "No further pages to scrape or 'Next' button not available.";
          console.log(`[LinkedInScraper] ${completionMsg}`);
          stopScraping(completionMsg, false);
        }
      } catch (error) {
        console.error("[LinkedInScraper] Error continuing scraping:", error);
        stopScraping("Runtime error while continuing scraping: " + error.message, true);
      }
    }, 1500); // Reduced timeout, but ideally this should be event-driven.
  } else if (scrapingInProgress && !shouldContinue) {
      // If it was marked as in progress but session says not to continue
      console.log("[LinkedInScraper] Scraping was marked in progress but session 'scraperActive' is false. Stopping.");
      stopScraping("Scraping stopped, session state indicates inactive.");
  }
}


// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Make the listener async to handle async operations like startScraping properly for sendResponse
  (async () => {
    switch (message.type) {
      case "START_SCRAPING":
        // Pass sendResponse as a callback to be called after initial checks in startScraping
        await startScraping(sendResponse);
        // sendResponse will be called by startScraping, so return true is handled by that path.
        // Explicit return true here is not strictly needed if startScraping always calls sendResponse.
        // However, to be safe for other paths or future changes:
        return true;

      case "STOP_SCRAPING":
        stopScraping("User requested stop.");
        sendResponse({ success: true, message: "Scraping stop requested." });
        break;

      default:
        console.warn("[LinkedInScraper] Unknown message type received:", message.type);
        sendResponse({ success: false, error: "Unknown message type" });
    }
  })(); // Immediately invoke the async function

  // Crucially, return true from the main listener function if sendResponse will be called asynchronously.
  // This is now handled by startScraping which will call sendResponse.
  // For synchronous cases like STOP_SCRAPING or default, it's also fine.
  return true;
});

// Initialize when page loads
function init() {
  console.log("[LinkedInScraper] Content script loaded. URL:", location.href);
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
