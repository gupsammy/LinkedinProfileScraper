// Jest setup file for LinkedIn Profile Scraper tests
// Configures Chrome extension environment and global mocks

require('@testing-library/jest-dom');

// Setup Chrome extension APIs manually (jest-chrome has compatibility issues)
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  storage: {
    local: {
      set: jest.fn(),
      get: jest.fn(),
      clear: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn()
  }
};

global.chrome = mockChrome;

// Mock Chrome extension APIs with realistic behavior
mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
  const response = { success: true };
  
  // Simulate different responses based on message type
  switch (message?.type) {
    case 'SAVE_PROFILES':
      response.saved = message.data?.length || 0;
      response.total = response.saved;
      break;
    case 'GET_STATUS':
      response.count = 0;
      break;
    case 'HEALTH_CHECK':
      response.health = { initialized: true, working: true };
      break;
    default:
      response.success = true;
  }
  
  if (callback) {
    setTimeout(() => callback(response), 10);
  }
  return Promise.resolve(response);
});

mockChrome.storage.local.set.mockImplementation((data) => {
  return Promise.resolve();
});

mockChrome.storage.local.get.mockImplementation((keys) => {
  return Promise.resolve({});
});

mockChrome.tabs.query.mockImplementation(() => {
  return Promise.resolve([
    { id: 1, url: 'https://www.linkedin.com/search/results/people/', active: true }
  ]);
});

mockChrome.tabs.sendMessage.mockImplementation(() => {
  return Promise.resolve({ success: true });
});

// Mock LinkedIn-like DOM environment
global.location = {
  href: 'https://www.linkedin.com/search/results/people/?keywords=engineer',
  pathname: '/search/results/people/',
  search: '?keywords=engineer'
};

global.history = {
  pushState: jest.fn(),
  replaceState: jest.fn()
};

global.sessionStorage = {
  getItem: jest.fn(() => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

// Mock IndexedDB for background script tests
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
const FDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');
global.indexedDB = new FDBFactory();
global.IDBKeyRange = FDBKeyRange;

// Utility function to create mock LinkedIn profile data
global.createMockProfile = (overrides = {}) => ({
  id: 'john-doe-123',
  name: 'John Doe',
  url: 'https://linkedin.com/in/john-doe-123',
  headline: 'Software Engineer at Tech Corp',
  location: 'San Francisco, CA',
  scrapedAt: Date.now(),
  ...overrides
});

// Utility function to create mock LinkedIn HTML
global.createMockLinkedInHTML = (profileCount = 3) => {
  const profiles = Array.from({ length: profileCount }, (_, i) => ({
    id: `profile-${i + 1}`,
    name: `Test User ${i + 1}`,
    headline: `Position ${i + 1} at Company ${i + 1}`,
    location: `City ${i + 1}, State ${i + 1}`
  }));

  const profileElements = profiles.map(profile => `
    <li data-chameleon-result-urn="urn:li:fsd_profile:${profile.id}">
      <div class="mb1">
        <a href="https://linkedin.com/in/${profile.id}" class="dGCAEBVXgkGQKLntuWxHvfKkpBSICAYQaUlZpU">
          <img alt="${profile.name}" />
          <span dir="ltr">
            <span aria-hidden="true">${profile.name}</span>
          </span>
        </a>
        <div class="WQvDaGLgJAxxIvMgRXKtFRwauNhWHvbLmKV t-14 t-black t-normal">
          ${profile.headline}
        </div>
        <div class="DtvjKFRzdrPWFAkJEOCmaeJlenAlYxLEw t-14 t-normal">
          ${profile.location}
        </div>
      </div>
    </li>
  `).join('');

  return `
    <html>
      <body>
        <main>
          <ul>
            ${profileElements}
          </ul>
        </main>
        <div class="artdeco-pagination__page-state">
          Page 1 of 5
        </div>
      </body>
    </html>
  `;
};

// Console configuration for tests
global.console = {
  ...console,
  // Suppress console.log in tests unless debugging
  log: process.env.DEBUG_TESTS ? console.log : jest.fn(),
  error: console.error,
  warn: console.warn,
  info: console.info
};

// Clean up after each test
afterEach(() => {
  // Clear all mocks
  mockChrome.runtime.sendMessage.mockClear();
  mockChrome.storage.local.set.mockClear();
  mockChrome.storage.local.get.mockClear();
  mockChrome.tabs.query.mockClear();
  mockChrome.tabs.sendMessage.mockClear();
  
  // Clear DOM
  document.body.innerHTML = '';
  
  // Reset window globals
  Object.keys(window).forEach(key => {
    if (key.startsWith('LinkedInScraper')) {
      delete window[key];
    }
  });
});

console.log('✅ Jest setup complete - Chrome extension testing environment configured');