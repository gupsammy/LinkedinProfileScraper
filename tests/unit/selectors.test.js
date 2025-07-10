// Unit tests for selectors.js module
// Tests DOM selector arrays and their structure

describe('Selectors Module', () => {
  let selectors;

  beforeEach(() => {
    // Load the selectors module
    const fs = require('fs');
    const selectorsCode = fs.readFileSync('./src/lib/selectors.js', 'utf8');
    eval(selectorsCode);
    selectors = window.LinkedInScraperSelectors;
  });

  describe('Module Structure', () => {
    test('exports all required selector arrays', () => {
      expect(selectors).toBeDefined();
      expect(Array.isArray(selectors.resultSelectors)).toBe(true);
      expect(Array.isArray(selectors.profileLinkSelectors)).toBe(true);
      expect(Array.isArray(selectors.nameSelectors)).toBe(true);
      expect(Array.isArray(selectors.headlineSelectors)).toBe(true);
      expect(Array.isArray(selectors.locationSelectors)).toBe(true);
      expect(Array.isArray(selectors.paginationSelectors)).toBe(true);
    });

    test('all selector arrays contain non-empty strings', () => {
      Object.values(selectors).forEach(selectorArray => {
        expect(Array.isArray(selectorArray)).toBe(true);
        expect(selectorArray.length).toBeGreaterThan(0);
        
        selectorArray.forEach(selector => {
          expect(typeof selector).toBe('string');
          expect(selector.trim().length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Result Selectors', () => {
    test('contains expected number of fallback strategies', () => {
      expect(selectors.resultSelectors.length).toBeGreaterThanOrEqual(7);
    });

    test('includes primary structural selectors', () => {
      const { resultSelectors } = selectors;
      
      expect(resultSelectors).toContain('main ul li');
      expect(resultSelectors).toContain('main div ul li');
      expect(resultSelectors.some(s => s.includes('data-chameleon-result-urn'))).toBe(true);
    });

    test('selectors are ordered by specificity', () => {
      const { resultSelectors } = selectors;
      
      // More specific selectors should come first
      const dataAttributeIndex = resultSelectors.findIndex(s => s.includes('data-chameleon-result-urn'));
      const genericIndex = resultSelectors.findIndex(s => s === 'main ul li');
      
      expect(dataAttributeIndex).toBeLessThan(genericIndex);
    });

    test('includes legacy fallback selectors', () => {
      const { resultSelectors } = selectors;
      
      expect(resultSelectors.some(s => s.includes('search-results-container'))).toBe(true);
    });
  });

  describe('Profile Link Selectors', () => {
    test('contains selectors for LinkedIn profile links', () => {
      const { profileLinkSelectors } = selectors;
      
      expect(profileLinkSelectors.length).toBeGreaterThanOrEqual(3);
      
      // All should target links with /in/ in href
      profileLinkSelectors.forEach(selector => {
        expect(selector).toMatch(/href\*=.*\/in\//);
      });
    });

    test('includes hash-based class selectors', () => {
      const { profileLinkSelectors } = selectors;
      
      expect(profileLinkSelectors.some(s => s.includes('dGCAEBVXgkGQKLntuWxHvfKkpBSICAYQaUlZpU'))).toBe(true);
    });

    test('includes semantic fallback selectors', () => {
      const { profileLinkSelectors } = selectors;
      
      expect(profileLinkSelectors.some(s => s.includes('div.mb1'))).toBe(true);
    });

    test('excludes search links', () => {
      const { profileLinkSelectors } = selectors;
      
      expect(profileLinkSelectors.some(s => s.includes(':not([href*="search"])'))).toBe(true);
    });
  });

  describe('Name Selectors', () => {
    test('prioritizes image alt attributes', () => {
      const { nameSelectors } = selectors;
      
      expect(nameSelectors[0]).toBe('img[alt]');
    });

    test('includes span-based extraction strategies', () => {
      const { nameSelectors } = selectors;
      
      expect(nameSelectors.some(s => s.includes('span[dir="ltr"]'))).toBe(true);
      expect(nameSelectors.some(s => s.includes('span[aria-hidden="true"]'))).toBe(true);
    });

    test('excludes visually-hidden elements', () => {
      const { nameSelectors } = selectors;
      
      expect(nameSelectors.some(s => s.includes(':not(.visually-hidden)'))).toBe(true);
    });

    test('includes progressive fallback strategies', () => {
      const { nameSelectors } = selectors;
      
      // Should have exact match, then less specific matches
      const exactMatch = nameSelectors.find(s => s.includes('span[dir="ltr"] > span[aria-hidden="true"]'));
      const flexibleMatch = nameSelectors.find(s => s.includes('span[dir="ltr"] span[aria-hidden="true"]'));
      
      expect(exactMatch).toBeDefined();
      expect(flexibleMatch).toBeDefined();
      expect(nameSelectors.indexOf(exactMatch)).toBeLessThan(nameSelectors.indexOf(flexibleMatch));
    });
  });

  describe('Headline Selectors', () => {
    test('includes hash-based class selectors', () => {
      const { headlineSelectors } = selectors;
      
      expect(headlineSelectors.some(s => s.includes('WQvDaGLgJAxxIvMgRXKtFRwauNhWHvbLmKV'))).toBe(true);
    });

    test('includes semantic class combinations', () => {
      const { headlineSelectors } = selectors;
      
      expect(headlineSelectors.some(s => s.includes('t-14.t-black.t-normal'))).toBe(true);
    });

    test('includes contextual selectors', () => {
      const { headlineSelectors } = selectors;
      
      expect(headlineSelectors.some(s => s.includes('div.mb1'))).toBe(true);
    });

    test('includes legacy fallback', () => {
      const { headlineSelectors } = selectors;
      
      expect(headlineSelectors.some(s => s.includes('entity-result__primary-subtitle'))).toBe(true);
    });
  });

  describe('Location Selectors', () => {
    test('includes hash-based class selectors', () => {
      const { locationSelectors } = selectors;
      
      expect(locationSelectors.some(s => s.includes('DtvjKFRzdrPWFAkJEOCmaeJlenAlYxLEw'))).toBe(true);
    });

    test('excludes black text (to avoid headlines)', () => {
      const { locationSelectors } = selectors;
      
      expect(locationSelectors.some(s => s.includes(':not(.t-black)'))).toBe(true);
    });

    test('includes pattern matching selectors', () => {
      const { locationSelectors } = selectors;
      
      expect(locationSelectors.some(s => s.includes('[class*="t-14"]'))).toBe(true);
    });

    test('includes legacy fallback', () => {
      const { locationSelectors } = selectors;
      
      expect(locationSelectors.some(s => s.includes('entity-result__secondary-subtitle'))).toBe(true);
    });
  });

  describe('Pagination Selectors', () => {
    test('includes current page state selector', () => {
      const { paginationSelectors } = selectors;
      
      expect(paginationSelectors.some(s => s.includes('artdeco-pagination__page-state'))).toBe(true);
    });

    test('includes last page button selectors', () => {
      const { paginationSelectors } = selectors;
      
      expect(paginationSelectors.some(s => s.includes('li:last-child button'))).toBe(true);
      expect(paginationSelectors.some(s => s.includes('indicator--number:last-child'))).toBe(true);
    });

    test('targets pagination-specific elements', () => {
      const { paginationSelectors } = selectors;
      
      paginationSelectors.forEach(selector => {
        expect(selector).toContain('pagination');
      });
    });
  });

  describe('Selector Validation', () => {
    test('all selectors are valid CSS syntax', () => {
      Object.values(selectors).forEach(selectorArray => {
        selectorArray.forEach(selector => {
          // Test if selector is valid by trying to query with it
          expect(() => {
            document.querySelector(selector);
          }).not.toThrow();
        });
      });
    });

    test('selectors use proper CSS escaping', () => {
      Object.values(selectors).forEach(selectorArray => {
        selectorArray.forEach(selector => {
          // Check for unescaped special characters that could break selectors
          expect(selector).not.toMatch(/[^\\][$^|]/); // Unescaped special chars
          expect(selector).not.toMatch(/\s{2,}/); // Multiple spaces
          expect(selector.trim()).toBe(selector); // No leading/trailing spaces
        });
      });
    });

    test('attribute selectors use proper quotes', () => {
      Object.values(selectors).forEach(selectorArray => {
        selectorArray.forEach(selector => {
          // Attribute values should be quoted
          const attributeMatches = selector.match(/\[([^=]+)=[^"'][^]]*\]/g);
          if (attributeMatches) {
            attributeMatches.forEach(match => {
              expect(match).toMatch(/=["'][^"']*["']/);
            });
          }
        });
      });
    });
  });

  describe('Fallback Strategy', () => {
    test('provides multiple fallback options for each selector type', () => {
      Object.entries(selectors).forEach(([key, selectorArray]) => {
        if (key !== 'paginationSelectors') { // Pagination may have fewer options
          expect(selectorArray.length).toBeGreaterThanOrEqual(3);
        }
      });
    });

    test('fallback order goes from specific to general', () => {
      const { resultSelectors } = selectors;
      
      // Data attribute selectors should come before generic ones
      const specificIndex = resultSelectors.findIndex(s => s.includes('[data-'));
      const genericIndex = resultSelectors.findIndex(s => s === 'main ul li');
      
      if (specificIndex !== -1 && genericIndex !== -1) {
        expect(specificIndex).toBeLessThan(genericIndex);
      }
    });

    test('includes both modern and legacy selector strategies', () => {
      const { headlineSelectors } = selectors;
      
      // Should have both hash-based modern selectors and semantic legacy ones
      const hasModern = headlineSelectors.some(s => s.match(/\.[A-Za-z0-9]{30,}/));
      const hasLegacy = headlineSelectors.some(s => s.includes('entity-result'));
      
      expect(hasModern).toBe(true);
      expect(hasLegacy).toBe(true);
    });
  });

  describe('Performance Considerations', () => {
    test('avoids overly complex selectors', () => {
      Object.values(selectors).forEach(selectorArray => {
        selectorArray.forEach(selector => {
          // Count selector complexity (descendant combinators)
          const complexity = (selector.match(/\s+/g) || []).length;
          expect(complexity).toBeLessThan(10); // Reasonable complexity limit
        });
      });
    });

    test('uses efficient selector patterns', () => {
      Object.values(selectors).forEach(selectorArray => {
        selectorArray.forEach(selector => {
          // Avoid universal selectors but allow attribute selectors with *
          expect(selector).not.toMatch(/\*(?![="'])/); // No bare * selectors
          expect(selector).not.toMatch(/^\s*\w+\s*$/); // Avoid bare tag selectors
        });
      });
    });
  });
});