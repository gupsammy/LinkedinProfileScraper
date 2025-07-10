# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome Extension (Manifest V3) that scrapes LinkedIn people search results and stores profile data locally in IndexedDB. The extension is designed for educational purposes and includes anti-detection features like random delays and respectful scraping practices.

## Architecture

### Core Components

- **Manifest V3 Extension** with content script injection on LinkedIn people search pages
- **Content Script** (`scraper.js`) - Runs on LinkedIn pages, extracts profile data, handles pagination
- **Background Service Worker** (`background.js`) - Manages IndexedDB operations and message routing
- **Popup UI** (`popup/`) - User interface for controlling scraping and data management

### Data Flow

1. Content script detects valid LinkedIn people search pages
2. Extracts profile data using multiple fallback DOM selectors
3. Sends data to background worker for IndexedDB storage
4. Handles automatic pagination with session persistence
5. Popup provides controls for export/import/clear operations

## Key Technical Details

### Profile Data Structure

```javascript
{
  id: string,        // Profile slug from URL (/in/johndoe -> "johndoe")
  name: string,      // Full name
  url: string,       // Clean profile URL (no query params)
  headline: string,  // Professional headline
  location: string,  // Location information
  scrapedAt: number  // Timestamp
}
```

### DOM Selectors Strategy

The extension uses a hierarchical fallback approach for maximum reliability across LinkedIn's frequent UI changes:

**Result Containers (Progressive Depth)**:

- `main ul li` - Most direct approach
- `main div ul li`, `main div div ul li`, `main div div div ul li`, `main div div div div ul li` - Increasing depth levels
- `div[data-chameleon-result-urn] li` - Data attribute approach
- `li[data-chameleon-result-urn]` - Direct li with data attributes
- `.search-results-container li` - Legacy fallback

**Profile Links (Hash-based Classes)**:

- `a.mgFkhbNCAguTzbjLozeYRagsCtabmGnDJw[href*="/in/"]` - Stable hash class
- `div.mb1 a[href*="/in/"]` - Semantic container approach
- `a[href*="/in/"]:not([href*="search"])` - Generic fallback

**Name Extraction (Nested Span Strategy)**:

- `span[dir="ltr"] > span[aria-hidden="true"]` - Exact LinkedIn structure
- `span[dir="ltr"] span[aria-hidden="true"]` - Flexible nested approach
- Enhanced text validation to filter out status messages

**Headlines/Locations (Hash Classes with Semantic Fallbacks)**:

- Headlines: `.IiwrdSaZAZYmlnxRtwjZyHnRkVqELimfgEMk.t-14.t-black.t-normal`
- Locations: `.dYSmssFoeurfwRBkaSJKzhvqkVuxjhmxk.t-14.t-normal`
- Semantic fallbacks using `t-14`, `t-black`, `t-normal` classes

### Pagination & Session Persistence

- Uses `sessionStorage` to maintain scraping state across page navigations
- Automatically detects total pages from pagination elements
- Implements random delays (500-1500ms) between page transitions
- Gracefully handles interruptions and allows resumption

## Development Commands

### Loading Extension

1. Open `chrome://extensions/`
2. Enable Developer mode
3. Click "Load unpacked" and select project directory

### Testing

- **Live Testing**: Test on LinkedIn people search pages: `https://www.linkedin.com/search/results/people/?keywords=...`
- **Selector Testing**: Run `node test_scripts/test_all_samples.js` to validate DOM selectors against sample data
- **Robust Extraction**: Run `node test_scripts/test_robust_extraction.js` to test extraction logic
- **Missing Fields**: Run `node test_scripts/test_missing_fields.js` to test handling of incomplete data
- Monitor browser console for scraping logs
- Use Chrome DevTools > Application > IndexedDB to inspect stored data

### Prerequisites

- Node.js (for running test scripts)
- Install dependencies: `npm install` (installs jsdom for testing)

### Debugging

- Background script logs: Chrome Extensions page > Inspect views: background page
- Content script logs: Open DevTools on LinkedIn page
- IndexedDB inspection: DevTools > Application tab > IndexedDB > linkedin_profiles

## Key Files and Responsibilities

- `manifest.json` - Extension configuration, permissions, content script matching
- `background.js` - IndexedDB wrapper class, message handling, data export/import
- `scraper.js` - Page detection, DOM scraping, pagination logic, session management
- `popup/popup.js` - UI controller, file operations, progress tracking
- `popup/popup.html` - Extension popup interface
- `popup/popup.css` - Popup styling
- `test_scripts/` - Node.js test suite for validating selector logic and data extraction

## Security & Anti-Detection

- Only scrapes publicly visible LinkedIn data
- Implements random delays between page loads
- Uses standard DOM selectors (no aggressive techniques)
- Local storage only (no external servers)
- Minimal required permissions
- Respects existing page load times

## Data Management

### Export Format

JSON array with timestamp-based filename: `linkedin_profiles_YYYY-MM-DD.json`

### Deduplication

Uses profile ID as primary key in IndexedDB - automatic upsert behavior prevents duplicates

### Import Validation

Validates required fields (`id`, `name`, `url`) and array structure before import

## Testing Architecture

### Test Scripts Overview

The project includes Node.js-based test scripts that validate the scraper's DOM selection logic:

- **test_all_samples.js** - Tests all selector fallbacks against sample HTML data
- **test_robust_extraction.js** - Validates extraction logic handles various HTML structures
- **test_missing_fields.js** - Tests graceful handling of incomplete profile data
- **debug_data_sample5.js** - Specific test for debugging selector issues

### Testing Strategy

- Uses jsdom to simulate LinkedIn's DOM structure
- Tests multiple selector fallbacks to ensure robustness
- Validates extraction logic against various HTML patterns
- No external dependencies or live LinkedIn access required for testing

## Enhanced Error Handling & Debugging

### Robust Data Extraction

- **Partial Profile Saving**: Saves profiles even with missing fields (name defaults to "Unknown Name")
- **Text Validation**: Filters out status messages ("Status is offline", "Online", etc.) from name extraction
- **Enhanced Logging**: Detailed console output for debugging selector performance
- **Graceful Degradation**: Multiple fallback strategies ensure maximum data capture

### Debugging Features

- **Selector Testing**: Automatic testing of all selectors on page load with result counts
- **Name Extraction Debugging**: Logs all span elements and their content when name extraction fails
- **Pagination Debugging**: Comprehensive logging of pagination elements and structure
- **Session State**: Persistent scraping state across page navigations with stop/resume capability
