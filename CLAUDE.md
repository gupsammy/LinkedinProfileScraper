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
The extension uses multiple fallback selectors due to LinkedIn's frequent UI changes:
- Result containers: `li.reusable-search__result-container`, `.search-results-container .search-result`
- Profile links: `a[href*="/in/"]`, `.entity-result__title-text a`
- Headlines: `.entity-result__primary-subtitle`, `.search-result__info .subline-level-1`
- Locations: `.entity-result__secondary-subtitle`, `.entity-result__location`

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
- Test on LinkedIn people search pages: `https://www.linkedin.com/search/results/people/?keywords=...`
- Monitor browser console for scraping logs
- Use Chrome DevTools > Application > IndexedDB to inspect stored data

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