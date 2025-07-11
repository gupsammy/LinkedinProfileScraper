// Core profile extraction logic
// Extracted from scraper.js during modularization

// Extract profile data from search results on current page
function extractProfilesFromPage() {
  try {
    const profiles = [];
    const { resultSelectors, profileLinkSelectors, nameSelectors } =
      window.LinkedInScraper.getNS("Selectors") || {};

    if (!resultSelectors) {
      console.error("Result selectors not available from selectors module");
      return [];
    }

    let searchResults = [];
    let searchResultsSelector = "";

    for (const selector of resultSelectors) {
      if (selector === "div[data-chameleon-result-urn]") {
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

    if (searchResults.length === 0) {
      console.log("No search results found on this page using any selector");
      return [];
    }

    console.log(`Found results using selector: ${searchResultsSelector}`);
    console.log(`Found ${searchResults.length} profile results`);

    searchResults.forEach((result, index) => {
      const profile = extractSingleProfile(result, index);
      if (profile) {
        profiles.push(profile);
      }
    });

    return profiles;
  } catch (error) {
    console.error("Error extracting profiles from page:", error);
    return [];
  }
}

// Extract a single profile from a result element
function extractSingleProfile(result, index) {
  try {
    const { profileLinkSelectors, nameSelectors } =
      window.LinkedInScraper.getNS("Selectors") || {};

    if (!profileLinkSelectors) {
      console.error(
        "Profile link selectors not available from selectors module"
      );
      return null;
    }

    let profileLink = null;
    let profileName = "";
    let foundLinkElement = null;

    // Extract profile link
    for (const selector of profileLinkSelectors) {
      const linkElements = result.querySelectorAll(selector);

      for (const linkElement of linkElements) {
        if (linkElement && linkElement.href) {
          profileLink = linkElement.href;
          foundLinkElement = linkElement;

          // Extract name from the link element
          if (nameSelectors) {
            profileName = extractNameFromElement(linkElement, nameSelectors);
          }

          if (profileName) {
            break;
          }
        }
      }

      if (profileLink && profileName) {
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
      return null;
    }

    // Fallback name extraction if needed
    if (!profileName) {
      debugNameExtractionFailure(foundLinkElement, index);
      profileName = extractNameFallback(profileLink);
    }

    return {
      profileLink,
      profileName: profileName || "Name not available",
      resultElement: result,
      index,
    };
  } catch (error) {
    console.error(`Error extracting profile ${index + 1}:`, error);
    return null;
  }
}

// Extract name from a link element using various strategies
function extractNameFromElement(linkElement, nameSelectors) {
  for (const nameSelector of nameSelectors) {
    const nameElement = linkElement.querySelector(nameSelector);
    if (nameElement) {
      let extractedName = "";

      if (nameElement.tagName.toLowerCase() === "img" && nameElement.alt) {
        extractedName = nameElement.alt.trim();
      } else if (nameElement.textContent && nameElement.textContent.trim()) {
        extractedName = nameElement.textContent
          .trim()
          .replace(/<!---->/g, "")
          .trim();
      }

      if (extractedName && isValidName(extractedName)) {
        console.log(
          `Found name using selector "${nameSelector}": "${extractedName}"`
        );
        return extractedName;
      } else if (extractedName) {
        console.log(
          `Rejected text "${extractedName}" from selector "${nameSelector}" (appears to be status or invalid)`
        );
      }
    }
  }
  return "";
}

// Enhanced debugging when name extraction fails completely
function debugNameExtractionFailure(linkElement, index) {
  console.warn(
    `Profile link found but no name extracted for result ${index + 1}`
  );

  console.log(
    "Debug - Link element HTML:",
    linkElement
      ? linkElement.outerHTML.substring(0, 300) + "..."
      : "No link element"
  );
  console.log(
    "Debug - Link text content:",
    linkElement ? linkElement.textContent.substring(0, 200) : "No link element"
  );

  // Show all span elements within the link for debugging
  if (linkElement) {
    const allSpans = linkElement.querySelectorAll("span");
    console.log(`Debug - Found ${allSpans.length} span elements in link:`);
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

// Validate if extracted text looks like a real name
function isValidName(name) {
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
    name.toLowerCase().includes(phrase.toLowerCase())
  );

  return (
    name.length > 1 &&
    name.length < 100 &&
    !isStatusText &&
    /^[a-zA-Z\s\u00C0-\u017F\u0100-\u024F\u1E00-\u1EFF\u2000-\u206F\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F\u0370-\u03FF\u1F00-\u1FFF()]+/.test(
      name
    )
  );
}

// Extract name from URL as last resort
function extractNameFallback(profileLink) {
  try {
    const urlParts = profileLink.split("/in/")[1]?.split("?")[0]?.split("/")[0];

    if (urlParts && urlParts.length > 2) {
      const nameFromUrl = urlParts
        .replace(/-\d+$/, "")
        .split("-")
        .filter((part) => part.length > 1 && !/^\d+$/.test(part))
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ");

      if (nameFromUrl.length > 2) {
        console.log(`📝 Extracted name from URL: "${nameFromUrl}"`);
        return nameFromUrl;
      }
    }
  } catch (error) {
    console.log("Failed to extract name from URL:", error);
  }
  return "";
}

// Export functions using consolidated namespace
if (window.LinkedInScraper && window.LinkedInScraper.registerModule) {
  window.LinkedInScraper.registerModule("Extractor", {
    extractProfilesFromPage,
    extractSingleProfile,
    extractNameFromElement,
    isValidName,
    extractNameFallback,
    debugNameExtractionFailure,
  });
}

console.log("extractor.js module loaded");
