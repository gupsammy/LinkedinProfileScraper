// Data validation and cleaning
// Extracted from scraper.js during modularization

// Extract and validate additional profile fields (headline, location)
function extractAdditionalFields(resultElement) {
  const { headlineSelectors, locationSelectors } =
    window.LinkedInScraper.getNS("Selectors") || {};

  let headline = "";
  let location = "";

  // Extract headline
  if (headlineSelectors) {
    for (const selector of headlineSelectors) {
      const headlineElement = resultElement.querySelector(selector);
      if (headlineElement && headlineElement.textContent.trim()) {
        headline = cleanText(headlineElement.textContent.trim());
        break;
      }
    }
  }

  // Extract location
  if (locationSelectors) {
    for (const selector of locationSelectors) {
      const locationElement = resultElement.querySelector(selector);
      if (locationElement && locationElement.textContent.trim()) {
        location = cleanText(locationElement.textContent.trim());
        break;
      }
    }
  }

  return { headline, location };
}

// Clean and sanitize text content
function cleanText(text) {
  return text
    .replace(/<!---->/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Create complete profile object with validation
function createValidatedProfile(profileData) {
  const { extractProfileId, cleanProfileUrl } =
    window.LinkedInScraper.getNS("Utils") || {};

  if (!extractProfileId || !cleanProfileUrl) {
    console.error("Utility functions not available");
    return null;
  }

  const { profileLink, profileName, resultElement, index } = profileData;

  // Extract additional fields
  const { headline, location } = extractAdditionalFields(resultElement);

  // Clean and validate data
  const cleanUrl = cleanProfileUrl(profileLink);
  const profileId = extractProfileId(cleanUrl);

  // Only create profile if we have essential data
  if (!profileId || !cleanUrl) {
    console.error(
      `❌ Cannot save profile ${index + 1} - missing essential data:`
    );
    console.log(`  Profile ID: "${profileId}"`);
    console.log(`  Clean URL: "${cleanUrl}"`);
    console.log(`  Original URL: "${profileLink}"`);
    return null;
  }

  const profile = {
    id: profileId,
    name: profileName || "Name not available",
    url: cleanUrl,
    headline: headline || "Headline not available",
    location: location || "Location not available",
    scrapedAt: Date.now(),
  };

  // Log missing fields for debugging
  const missingFields = [];
  if (!profileName || profileName === "Name not available")
    missingFields.push("name");
  if (!headline || headline === "Headline not available")
    missingFields.push("headline");
  if (!location || location === "Location not available")
    missingFields.push("location");

  if (missingFields.length > 0) {
    console.log(
      `  ⚠️  Missing fields: ${missingFields.join(
        ", "
      )} - using fallback values`
    );
  }

  console.log(`Scraped profile ${index + 1}:`, profile);
  return profile;
}

// Validate profile array before saving
function validateProfileArray(profiles) {
  if (!Array.isArray(profiles)) {
    console.error("Profiles must be an array");
    return [];
  }

  return profiles.filter((profile) => {
    if (!profile || typeof profile !== "object") {
      console.warn("Invalid profile object:", profile);
      return false;
    }

    if (!profile.id || !profile.url) {
      console.warn("Profile missing required fields (id, url):", profile);
      return false;
    }

    return true;
  });
}

// Export functions using consolidated namespace
if (window.LinkedInScraper && window.LinkedInScraper.registerModule) {
  window.LinkedInScraper.registerModule("Validator", {
    extractAdditionalFields,
    cleanText,
    createValidatedProfile,
    validateProfileArray,
  });
}

console.log("validator.js module loaded");
