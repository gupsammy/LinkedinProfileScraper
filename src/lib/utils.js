// Generic utility functions and constants
// Extracted from scraper.js during modularization

// Extract profile ID from LinkedIn URL
function extractProfileId(url) {
  if (!url) return null;
  const match = url.match(/\/in\/([^/?]+)/);
  return match ? match[1] : null;
}

// Clean profile URL by removing query parameters
function cleanProfileUrl(url) {
  if (!url) return null;
  const cleanUrl = url.split("?")[0]; // Remove query parameters
  return cleanUrl;
}

// Async sleep utility
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Generate random delay between 500-1500ms for anti-detection
function getRandomDelay() {
  return Math.floor(Math.random() * 1000) + 500; // 500-1500ms
}

// Export functions using consolidated namespace
if (window.LinkedInScraper && window.LinkedInScraper.registerModule) {
  window.LinkedInScraper.registerModule("Utils", {
    extractProfileId,
    cleanProfileUrl,
    sleep,
    getRandomDelay,
  });
}

console.log("utils.js module loaded");
