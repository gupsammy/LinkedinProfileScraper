# LinkedIn People Search Scraper – Development Plan

\*Last updated: {{TODAY}}

---

## 1. Goal

Build a Chrome Extension (Manifest v3) that, when activated on a LinkedIn _people search_ results page, will:

1. Detect it is on a valid search page.
2. Determine the total number of result pages.
3. Loop through every page, scrape basic profile data for each result (name, profile URL, headline, location).
4. Persist all records into IndexedDB.
5. Provide popup-menu buttons to:
   - Start / stop scraping (if not auto-started).
   - Export data as JSON (download file).
   - Import data from JSON (merge / overwrite option).
   - Clear the database completely.

## 2. High-Level Architecture

| Layer                                                  | Responsibility                                                                                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Manifest v3**                                        | Permissions, host access ( `https://www.linkedin.com/*` ), declares content-script & service-worker & popup.                                                  |
| **Content Script** (`scraper.js`)                      | Runs in the context of every LinkedIn page. Detects eligibility, extracts DOM data, sends it to the background worker and triggers pagination.                |
| **Background/Service Worker** (`background.js`)        | Central message hub; owns **IndexedDB** helpers (using idb-keyval wrapper for ease), responds to popup actions.                                               |
| **Popup UI** (`popup.html` + `popup.js` + `popup.css`) | Small React/Lit/no-framework UI with four buttons (Start, Export, Import, Clear) + progress label. Communicates with worker via `chrome.runtime.sendMessage`. |

## 3. Manifest (v3) essentials

```jsonc
{
  "name": "LinkedIn People Search Scraper",
  "manifest_version": 3,
  "version": "0.1.0",
  "description": "Scrapes LinkedIn people-search results into IndexedDB and lets you export/import JSON.",
  "permissions": ["tabs", "scripting", "storage"],
  "host_permissions": ["https://www.linkedin.com/*"],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://www.linkedin.com/search/results/people/*"],
      "js": ["scraper.js"],
      "run_at": "document_end"
    }
  ]
}
```

## 4. Database Design (IndexedDB)

Use one object-store `profiles` keyed by canonical profile _id_ (slug after `/in/`).

```ts
interface Profile {
  id: string; // "jaiswalprakhar"
  name: string;
  url: string; // full https://www.linkedin.com/in/...
  headline: string; // title line
  location: string;
  scrapedAt: number; // Date.now()
}
```

**Deduplication – unique key**  
`id` acts as the _primary key_ for the `profiles` object-store. We derive it from the cleaned profile URL (anything after `/in/` and before the next slash or `?`).  
When saving, we use **`put()`** (or idb-keyval's `set()` / `setMany()`) which upserts—i.e. inserts when new, overwrites if the key already exists—so duplicate profiles are automatically avoided.

Helper: wrap with [`idb-keyval`](https://github.com/jakearchibald/idb-keyval) for simple CRUD.

## 5. DOM Selectors / XPaths

> LinkedIn changes markup often. Prefer _CSS selectors_ because they are shorter & easier to maintain. Provide XPaths as fallback.

### 5.1 Global checks

| Purpose              | CSS Selector                         | XPath (absolute)                                                |
| -------------------- | ------------------------------------ | --------------------------------------------------------------- |
| Total page count div | `div.artdeco-pagination__page-state` | `/html//div[contains(@class,'artdeco-pagination__page-state')]` |

Parse with regex `/Page \d+ of (\d+)/`.

### 5.2 Per-result row (loop over `li.reusable-search__result-container`)

| Field               | CSS                                            | XPath (relative to `li`)                        |
| ------------------- | ---------------------------------------------- | ----------------------------------------------- |
| Profile link & name | `a.app-aware-link` + inner `span[aria-hidden]` | `.//a[contains(@href,'/in/')][1]`               |
| Headline            | `div.entity-result__primary-subtitle`          | `.//div[contains(@class,'primary-subtitle')]`   |
| Location            | `div.entity-result__secondary-subtitle`        | `.//div[contains(@class,'secondary-subtitle')]` |

**Cleaning profile URL**: keep part before `?` (remove query params like `?miniProfileUrn=...`). `id` = last segment after `/in/`.

## 6. Scraping Flow (Content Script)

1. **On load** of search page:
   ```js
   if (!location.pathname.startsWith("/search/results/people")) return;
   ```
2. Extract _totalPages_ via selector above (default 1).
3. `scrapeCurrentPage()`
   - Iterate over all `li.reusable-search__result-container`.
   - Build `Profile` objects;
   - `chrome.runtime.sendMessage({ type:'SAVE_PROFILES', data: profiles });`
4. After saving, if `currentPage < totalPages` and scraping is **active**, navigate:
   ```js
   const next = currentPage + 1;
   const url = new URL(location.href);
   url.searchParams.set("page", next);
   location.href = url.toString();
   ```
   **Important**: set a flag in `sessionStorage` like `scraperActive=true` so new page continues automatically.
5. **On subsequent pages** the content script sees the flag and resumes.
6. When last page done → `chrome.runtime.sendMessage({ type:'SCRAPE_DONE' });` and clear flag.

## 7. Background Worker Responsibilities

```js
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  switch (msg.type) {
    case "SAVE_PROFILES":
      // Upsert to avoid duplicates
      await db.putMany(msg.data); // id is primary key, duplicates overwritten
      break;
    case "REQUEST_EXPORT":
      const json = await db.export();
      sendResponse(json);
      break;
    case "IMPORT_JSON":
      await db.import(msg.data);
      break;
    case "CLEAR_DB":
      await db.clear();
      break;
  }
});
```

Also listen to `chrome.tabs.onUpdated` to forward progress/status messages to popup.

## 8. Popup UI (HTML sketch)

```html
<button id="btnStart">Start Scraping</button>
<button id="btnExport">Export JSON</button>
<input
  type="file"
  id="importFile"
  accept="application/json"
  style="display:none;"
/>
<button id="btnImport">Import JSON</button>
<button id="btnClear">Clear DB</button>
<p id="status"></p>
```

Event handlers send messages to worker.

## 9. Permissions & Anti-detection Tips

- Scraping LinkedIn violates their ToS. Use for educational purposes only.
- Add random delay (500–1500 ms) between page switches to reduce suspicion.
- Only request minimal permissions (`storage`, `tabs`, `scripting`).
- Do **not** fetch remote resources; scrape local DOM only.

## 10. Milestones for Junior Dev

1. **Day 1**: Set up manifest, icons, hello-world popup.
2. **Day 2**: Implement IndexedDB helper + popup buttons (export/import/clear with dummy data).
3. **Day 3–4**: Write content script to detect page & scrape single page. Test saving.
4. **Day 5**: Add pagination loop & flag continuation across pages.
5. **Day 6**: Hook popup `Start` button to toggle scraping; show progress.
6. **Day 7**: Polish UI, error handling, code comments, README instructions.

## 11. Testing Checklist

- [ ] Scrape one page manually started.
- [ ] Scrape multi-page search.
- [ ] Export matches the count in DB.
- [ ] Clear DB empties export.
- [ ] Import JSON shows in export again.
- [ ] Extension survives browser restart while scraping disabled.

## 12. Future Enhancements

- Support collecting additional details by opening each profile in new tab & scraping about/experience.
- CSV export in addition to JSON.
- Progress bar with percentage.
- OAuth signin with LinkedIn (unlikely allowed) / user cookie detection.
- Dark-mode friendly popup.

---

**End of Plan**
