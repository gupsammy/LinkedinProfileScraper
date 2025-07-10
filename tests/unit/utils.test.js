// Unit tests for utils.js module
// Tests profile URL parsing, sleep utilities, and random delays

describe('Utils Module', () => {
  let utils;

  beforeEach(() => {
    // Load the utils module
    const fs = require('fs');
    const utilsCode = fs.readFileSync('./src/lib/utils.js', 'utf8');
    eval(utilsCode);
    utils = window.LinkedInScraperUtils;
  });

  describe('extractProfileId', () => {
    test('extracts profile ID from standard LinkedIn URL', () => {
      const url = 'https://www.linkedin.com/in/john-doe-123456/';
      expect(utils.extractProfileId(url)).toBe('john-doe-123456');
    });

    test('extracts profile ID from URL with query parameters', () => {
      const url = 'https://linkedin.com/in/jane-smith?trk=people-guest_people_search-card';
      expect(utils.extractProfileId(url)).toBe('jane-smith');
    });

    test('handles URLs with special characters in profile ID', () => {
      const url = 'https://linkedin.com/in/maría-josé-123';
      expect(utils.extractProfileId(url)).toBe('maría-josé-123');
    });

    test('handles URLs with numbers and hyphens', () => {
      const url = 'https://linkedin.com/in/user-name-12345';
      expect(utils.extractProfileId(url)).toBe('user-name-12345');
    });

    test('returns null for invalid URLs', () => {
      expect(utils.extractProfileId('invalid-url')).toBeNull();
      expect(utils.extractProfileId('https://example.com')).toBeNull();
      expect(utils.extractProfileId('')).toBeNull();
      expect(utils.extractProfileId(null)).toBeNull();
      expect(utils.extractProfileId(undefined)).toBeNull();
    });

    test('handles LinkedIn URLs without /in/ path', () => {
      const url = 'https://linkedin.com/company/tech-corp';
      expect(utils.extractProfileId(url)).toBeNull();
    });

    test('handles malformed LinkedIn URLs', () => {
      const url = 'https://linkedin.com/in/';
      expect(utils.extractProfileId(url)).toBeNull();
    });
  });

  describe('cleanProfileUrl', () => {
    test('removes query parameters from URL', () => {
      const url = 'https://linkedin.com/in/john-doe?trk=search&param=value';
      const expected = 'https://linkedin.com/in/john-doe';
      expect(utils.cleanProfileUrl(url)).toBe(expected);
    });

    test('returns URL unchanged if no query parameters', () => {
      const url = 'https://linkedin.com/in/john-doe';
      expect(utils.cleanProfileUrl(url)).toBe(url);
    });

    test('handles URLs with only query separator', () => {
      const url = 'https://linkedin.com/in/john-doe?';
      const expected = 'https://linkedin.com/in/john-doe';
      expect(utils.cleanProfileUrl(url)).toBe(expected);
    });

    test('handles URLs with fragment identifier', () => {
      const url = 'https://linkedin.com/in/john-doe#experience';
      expect(utils.cleanProfileUrl(url)).toBe(url); // Fragment should remain
    });

    test('returns null for null/undefined input', () => {
      expect(utils.cleanProfileUrl(null)).toBeNull();
      expect(utils.cleanProfileUrl(undefined)).toBeNull();
    });

    test('handles empty string', () => {
      expect(utils.cleanProfileUrl('')).toBeNull();
    });

    test('handles complex query parameters', () => {
      const url = 'https://linkedin.com/in/john-doe?trk=people&originalSubdomain=www&param1=value1&param2=value2';
      const expected = 'https://linkedin.com/in/john-doe';
      expect(utils.cleanProfileUrl(url)).toBe(expected);
    });
  });

  describe('sleep', () => {
    test('returns a Promise', () => {
      const result = utils.sleep(100);
      expect(result).toBeInstanceOf(Promise);
    });

    test('resolves after specified delay', async () => {
      const startTime = Date.now();
      await utils.sleep(100);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Allow for some variance in timing (±20ms)
      expect(duration).toBeGreaterThanOrEqual(80);
      expect(duration).toBeLessThan(150);
    });

    test('works with zero delay', async () => {
      const startTime = Date.now();
      await utils.sleep(0);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(50); // Should be very fast
    });

    test('handles large delays', async () => {
      const startTime = Date.now();
      await utils.sleep(200);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeGreaterThanOrEqual(180);
      expect(duration).toBeLessThan(250);
    });
  });

  describe('getRandomDelay', () => {
    test('returns a number within expected range (500-1500ms)', () => {
      for (let i = 0; i < 100; i++) {
        const delay = utils.getRandomDelay();
        expect(delay).toBeGreaterThanOrEqual(500);
        expect(delay).toBeLessThanOrEqual(1500);
        expect(Number.isInteger(delay)).toBe(true);
      }
    });

    test('returns different values on subsequent calls', () => {
      const delays = new Set();
      for (let i = 0; i < 50; i++) {
        delays.add(utils.getRandomDelay());
      }
      
      // Should have generated at least 10 different values
      expect(delays.size).toBeGreaterThan(10);
    });

    test('maintains proper statistical distribution', () => {
      const delays = [];
      for (let i = 0; i < 1000; i++) {
        delays.push(utils.getRandomDelay());
      }
      
      const average = delays.reduce((sum, delay) => sum + delay, 0) / delays.length;
      
      // Average should be around 1000 (middle of 500-1500 range)
      expect(average).toBeGreaterThan(900);
      expect(average).toBeLessThan(1100);
    });
  });

  describe('Module Integration', () => {
    test('all functions are exported correctly', () => {
      expect(utils).toBeDefined();
      expect(typeof utils.extractProfileId).toBe('function');
      expect(typeof utils.cleanProfileUrl).toBe('function');
      expect(typeof utils.sleep).toBe('function');
      expect(typeof utils.getRandomDelay).toBe('function');
    });

    test('module exports are attached to window object', () => {
      expect(window.LinkedInScraperUtils).toBe(utils);
      expect(window.LinkedInScraperUtils).toEqual(utils);
    });

    test('functions work together for URL processing workflow', () => {
      const originalUrl = 'https://linkedin.com/in/test-user?trk=search';
      const cleanUrl = utils.cleanProfileUrl(originalUrl);
      const profileId = utils.extractProfileId(cleanUrl);
      
      expect(cleanUrl).toBe('https://linkedin.com/in/test-user');
      expect(profileId).toBe('test-user');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('handles non-string input for URL functions', () => {
      expect(utils.extractProfileId(123)).toBeNull();
      expect(utils.extractProfileId({})).toBeNull();
      expect(utils.extractProfileId([])).toBeNull();
      
      expect(utils.cleanProfileUrl(123)).toBeNull();
      expect(utils.cleanProfileUrl({})).toBeNull();
      expect(utils.cleanProfileUrl([])).toBeNull();
    });

    test('handles URLs with encoded characters', () => {
      const url = 'https://linkedin.com/in/user%20name?param=value%20encoded';
      const cleanUrl = utils.cleanProfileUrl(url);
      expect(cleanUrl).toBe('https://linkedin.com/in/user%20name');
    });

    test('sleep function handles invalid delays gracefully', async () => {
      // Should not throw errors, but behavior may vary
      await expect(utils.sleep(-1)).resolves.not.toThrow();
      await expect(utils.sleep('invalid')).resolves.not.toThrow();
    });
  });
});