# LinkedIn People Search Scraper - Chrome Extension

A Chrome extension that scrapes LinkedIn people search results and stores profile data locally in IndexedDB. This tool is designed for educational purposes and research use cases.

## ⚠️ Important Disclaimer

**This extension is for educational purposes only.** Scraping LinkedIn may violate their Terms of Service. Use at your own risk and always respect LinkedIn's robots.txt and terms of use. Consider using LinkedIn's official API for production applications.

## Features

- 🔍 Automatically detects LinkedIn people search pages
- 📄 Scrapes multiple pages automatically with pagination
- 💾 Stores data locally in IndexedDB (no external servers)
- 📊 Extracts: Name, Profile URL, Headline, Location
- 📥 Export data as JSON
- 📤 Import data from JSON files
- 🗑️ Clear database functionality
- 🎯 Deduplication based on profile URL
- ⏰ Random delays to reduce detection risk
- 🎨 Modern, clean UI

## Installation

### Method 1: Load Unpacked Extension (Development)

1. **Download the extension files** to a local folder
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer mode** (toggle in top-right corner)
4. **Click "Load unpacked"** and select the extension folder
5. **Pin the extension** to your toolbar for easy access

### Method 2: Create Icons (Optional)

The extension includes placeholder icons. To create proper icons:

1. Open `create_icons.html` in your browser
2. Click each canvas to download the icon
3. Save the downloaded files as `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png` in the `icons/` folder

## Usage

### Basic Workflow

1. **Navigate to LinkedIn** and log in
2. **Go to a people search page** (e.g., search for people with specific criteria)
   - Example: `https://www.linkedin.com/search/results/people/?keywords=software%20engineer`
3. **Open the extension popup** by clicking the extension icon
4. **Click "Start Scraping"** to begin the process
5. **Wait for completion** - the extension will automatically navigate through all pages
6. **Export your data** using the "Export JSON" button

### Step-by-Step Guide

#### 1. Search Setup

```
1. Go to linkedin.com/search/results/people/
2. Apply your desired filters:
   - Keywords (e.g., "IIT Kanpur", "Software Engineer")
   - Location filters
   - Industry filters
   - Connection level
3. Note the total number of pages in the results
```

#### 2. Start Scraping

```
1. Click the extension icon in your toolbar
2. Verify you're on a people search page
3. Click "Start Scraping"
4. The extension will:
   - Scrape the current page
   - Automatically navigate to the next page
   - Continue until all pages are processed
```

#### 3. Monitor Progress

```
- Watch the popup for progress updates
- Check the "Profiles Stored" counter
- Status badge shows current state
- Progress bar indicates completion
```

#### 4. Export Data

```
1. Click "Export JSON" when scraping is complete
2. Choose download location
3. File will be named: linkedin_profiles_YYYY-MM-DD.json
```

## Data Structure

The extension extracts and stores the following data for each profile:

```json
{
  "id": "johndoe",
  "name": "John Doe",
  "url": "https://www.linkedin.com/in/johndoe",
  "headline": "Software Engineer at Google",
  "location": "San Francisco, CA",
  "scrapedAt": 1672531200000
}
```

### Field Descriptions

| Field       | Description                   | Example                                 |
| ----------- | ----------------------------- | --------------------------------------- |
| `id`        | Profile identifier (URL slug) | `"johndoe"`                             |
| `name`      | Full name of the person       | `"John Doe"`                            |
| `url`       | Clean profile URL             | `"https://www.linkedin.com/in/johndoe"` |
| `headline`  | Professional headline         | `"Software Engineer at Google"`         |
| `location`  | Current location              | `"San Francisco, CA"`                   |
| `scrapedAt` | Timestamp when scraped        | `1672531200000`                         |

## Technical Details

### Architecture

- **Manifest V3** Chrome Extension
- **Content Script** (`scraper.js`) - Runs on LinkedIn pages
- **Background Service Worker** (`background.js`) - Handles data storage
- **Popup UI** (`popup.html` + `popup.js` + `popup.css`) - User interface
- **IndexedDB** - Local data storage

### DOM Selectors

The extension uses multiple fallback selectors to handle LinkedIn's dynamic markup:

#### Profile Results

```javascript
// Main result containers
"li.reusable-search__result-container";
".search-results-container .search-result";
".search-results__list .search-result";
```

#### Profile Links

```javascript
'a[href*="/in/"]';
'.search-result__info a[href*="/in/"]';
".entity-result__title-text a";
```

#### Headlines

```javascript
".entity-result__primary-subtitle";
".search-result__info .subline-level-1";
".entity-result__subtitle";
```

#### Locations

```javascript
".entity-result__secondary-subtitle";
".search-result__info .subline-level-2";
".entity-result__location";
```

### Anti-Detection Features

- Random delays (500-1500ms) between page navigation
- Respects existing page load times
- Uses standard DOM selectors (no aggressive scraping)
- Local storage only (no external requests)
- Minimal permissions requested

## File Structure

```
linkedin-profile-scraper/
├── manifest.json              # Extension configuration
├── background.js              # Service worker
├── scraper.js                 # Content script
├── popup/
│   ├── popup.html            # Popup interface
│   ├── popup.js              # Popup logic
│   └── popup.css             # Popup styling
├── icons/
│   ├── icon16.png            # 16x16 icon
│   ├── icon32.png            # 32x32 icon
│   ├── icon48.png            # 48x48 icon
│   └── icon128.png           # 128x128 icon
├── create_icons.html          # Icon generator utility
├── plan.md                    # Development plan
└── README.md                  # This file
```

## Troubleshooting

### Common Issues

**Extension doesn't start scraping**

- Ensure you're on a LinkedIn people search page
- Check that the URL contains `/search/results/people/`
- Refresh the page and try again

**Missing profile data**

- LinkedIn may have changed their HTML structure
- Check browser console for errors
- Some profiles may have privacy settings that hide information

**Scraping stops unexpectedly**

- LinkedIn may have rate limiting in place
- Try waiting a few minutes before restarting
- Check your internet connection

**Export shows no data**

- Verify profiles were successfully scraped (check counter)
- Try refreshing the extension popup
- Check browser console for IndexedDB errors

### Debugging

1. **Open Chrome DevTools** (F12)
2. **Check Console tab** for error messages
3. **Go to Application tab** → Storage → IndexedDB → linkedin_profiles
4. **Inspect the profiles store** to see stored data

## Development

### Prerequisites

- Chrome browser
- Basic knowledge of JavaScript
- Understanding of Chrome Extension development

### Setup for Development

1. Clone or download the source code
2. Make your modifications
3. Load the unpacked extension in Chrome
4. Test on LinkedIn people search pages

### Key Components

#### Content Script (`scraper.js`)

- Detects valid LinkedIn pages
- Extracts profile data using DOM selectors
- Handles pagination automatically
- Manages session state across page loads

#### Background Worker (`background.js`)

- IndexedDB database operations
- Message routing between components
- Data export/import functionality
- Deduplication logic

#### Popup Interface (`popup/`)

- User controls and status display
- File export/import handling
- Real-time progress updates
- Error message display

## Privacy & Security

- **No external servers** - All data stays local
- **No personal data collection** - Only scrapes public LinkedIn data
- **No tracking** - Extension doesn't track your usage
- **Minimal permissions** - Only requests necessary Chrome API access

## Legal Considerations

- **Educational use only** - Not intended for commercial purposes
- **Respect LinkedIn's ToS** - Always follow platform guidelines
- **Rate limiting** - Extension includes delays to be respectful
- **Public data only** - Only scrapes publicly visible information

## Contributing

This is an educational project. If you want to contribute:

1. Fork the repository
2. Make your improvements
3. Test thoroughly
4. Submit a pull request

## License

This project is for educational purposes. Use responsibly and in accordance with LinkedIn's Terms of Service.

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review browser console for errors
3. Ensure you're using the latest version of Chrome
4. Verify LinkedIn hasn't changed their page structure

---

**Remember**: Always use this tool responsibly and in compliance with LinkedIn's Terms of Service. This is intended for educational and research purposes only.
