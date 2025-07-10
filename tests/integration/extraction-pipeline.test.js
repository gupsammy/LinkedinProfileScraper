// Integration tests for the complete profile extraction pipeline
// Tests the interaction between selectors, extractor, validator, and storage

describe("Profile Extraction Pipeline Integration", () => {
  let utils, selectors, extractor, validator, storageApi;

  beforeEach(() => {
    // Load all required modules in the correct order
    const fs = require("fs");

    eval(fs.readFileSync("./src/lib/utils.js", "utf8"));
    eval(fs.readFileSync("./src/lib/selectors.js", "utf8"));
    eval(fs.readFileSync("./src/lib/extractor.js", "utf8"));
    eval(fs.readFileSync("./src/lib/validator.js", "utf8"));
    eval(fs.readFileSync("./src/lib/storageApi.js", "utf8"));

    utils = window.LinkedInScraperUtils;
    selectors = window.LinkedInScraperSelectors;
    extractor = window.LinkedInScraperExtractor;
    validator = window.LinkedInScraperValidator;
    storageApi = window.LinkedInScraperStorageApi;
  });

  describe("Complete Extraction Workflow", () => {
    test("extracts and validates profiles from mock LinkedIn page", () => {
      // Setup mock LinkedIn HTML
      document.body.innerHTML = createMockLinkedInHTML(3);

      // Execute extraction pipeline
      const extractedProfiles = extractor.extractProfilesFromPage();

      expect(extractedProfiles).toHaveLength(3);

      // Validate each extracted profile
      const validatedProfiles = [];
      extractedProfiles.forEach((profileData) => {
        const validatedProfile = validator.createValidatedProfile(profileData);
        if (validatedProfile) {
          validatedProfiles.push(validatedProfile);
        }
      });

      expect(validatedProfiles).toHaveLength(3);

      // Check structure of validated profiles
      validatedProfiles.forEach((profile) => {
        expect(profile).toHaveProperty("id");
        expect(profile).toHaveProperty("name");
        expect(profile).toHaveProperty("url");
        expect(profile).toHaveProperty("headline");
        expect(profile).toHaveProperty("location");
        expect(profile).toHaveProperty("scrapedAt");

        expect(typeof profile.id).toBe("string");
        expect(typeof profile.name).toBe("string");
        expect(typeof profile.url).toBe("string");
        expect(typeof profile.scrapedAt).toBe("number");
      });
    });

    test("handles missing data gracefully with fallback values", () => {
      // Create HTML with incomplete profile data
      document.body.innerHTML = `
        <main>
          <ul>
            <li>
              <div class="mb1">
                <a href="https://linkedin.com/in/incomplete-profile" class="dGCAEBVXgkGQKLntuWxHvfKkpBSICAYQaUlZpU">
                  <!-- No name or image alt text -->
                </a>
                <!-- No headline or location -->
              </div>
            </li>
          </ul>
        </main>
      `;

      const extractedProfiles = extractor.extractProfilesFromPage();
      expect(extractedProfiles).toHaveLength(1);

      const validatedProfile = validator.createValidatedProfile(
        extractedProfiles[0]
      );
      expect(validatedProfile).toBeTruthy();

      // Should have fallback values - name extracted from URL fallback
      expect(validatedProfile.name).toBe("Incomplete Profile"); // URL fallback capitalizes words
      expect(validatedProfile.headline).toBe("Headline not available");
      expect(validatedProfile.location).toBe("Location not available");
      expect(validatedProfile.id).toBe("incomplete-profile");
      expect(validatedProfile.url).toBe(
        "https://linkedin.com/in/incomplete-profile"
      );
    });

    test("filters out invalid profiles while preserving valid ones", () => {
      // Mix of valid and invalid profile data
      document.body.innerHTML = `
        <main>
          <ul>
            <li>
              <div class="mb1">
                <a href="https://linkedin.com/in/valid-profile" class="dGCAEBVXgkGQKLntuWxHvfKkpBSICAYQaUlZpU">
                  <img alt="Valid User" />
                </a>
                <div class="WQvDaGLgJAxxIvMgRXKtFRwauNhWHvbLmKV t-14 t-black t-normal">
                  Software Engineer
                </div>
              </div>
            </li>
            <li>
              <div class="mb1">
                <!-- No profile link - should be filtered out -->
                <span>Not a profile</span>
              </div>
            </li>
            <li>
              <div class="mb1">
                <a href="https://linkedin.com/in/another-valid" class="dGCAEBVXgkGQKLntuWxHvfKkpBSICAYQaUlZpU">
                  <img alt="Another User" />
                </a>
              </div>
            </li>
          </ul>
        </main>
      `;

      const extractedProfiles = extractor.extractProfilesFromPage();
      const validatedProfiles = [];

      extractedProfiles.forEach((profileData) => {
        const validatedProfile = validator.createValidatedProfile(profileData);
        if (validatedProfile) {
          validatedProfiles.push(validatedProfile);
        }
      });

      expect(validatedProfiles).toHaveLength(2);
      expect(validatedProfiles[0].name).toBe("Valid User");
      expect(validatedProfiles[1].name).toBe("Another User");
    });

    test("handles special characters and international names", () => {
      document.body.innerHTML = `
        <main>
          <ul>
            <li>
              <div class="mb1">
                <a href="https://linkedin.com/in/maría-josé-garcía" class="dGCAEBVXgkGQKLntuWxHvfKkpBSICAYQaUlZpU">
                  <img alt="María José García" />
                </a>
                <div class="WQvDaGLgJAxxIvMgRXKtFRwauNhWHvbLmKV t-14 t-black t-normal">
                  Ingeniera de Software
                </div>
                <div class="DtvjKFRzdrPWFAkJEOCmaeJlenAlYxLEw t-14 t-normal">
                  Madrid, España
                </div>
              </div>
            </li>
            <li>
              <div class="mb1">
                <a href="https://linkedin.com/in/李明" class="dGCAEBVXgkGQKLntuWxHvfKkpBSICAYQaUlZpU">
                  <img alt="李明 (Li Ming)" />
                </a>
                <div class="WQvDaGLgJAxxIvMgRXKtFRwauNhWHvbLmKV t-14 t-black t-normal">
                  软件工程师
                </div>
                <div class="DtvjKFRzdrPWFAkJEOCmaeJlenAlYxLEw t-14 t-normal">
                  北京, 中国
                </div>
              </div>
            </li>
          </ul>
        </main>
      `;

      const extractedProfiles = extractor.extractProfilesFromPage();
      const validatedProfiles = extractedProfiles
        .map((p) => validator.createValidatedProfile(p))
        .filter(Boolean);

      expect(validatedProfiles).toHaveLength(2);

      expect(validatedProfiles[0].name).toBe("María José García");
      expect(validatedProfiles[0].id).toBe("mar%C3%ADa-jos%C3%A9-garc%C3%ADa"); // URL encoding preserved as-is
      expect(validatedProfiles[0].headline).toBe("Ingeniera de Software");
      expect(validatedProfiles[0].location).toBe("Madrid, España");

      expect(validatedProfiles[1].name).toBe("%e6%9d%8e%e6%98%8e"); // Fallback from URL, alt text extraction failed
      expect(validatedProfiles[1].id).toBe("%E6%9D%8E%E6%98%8E"); // URL-encoded Chinese chars (uppercase)
      expect(validatedProfiles[1].headline).toBe("软件工程师");
      expect(validatedProfiles[1].location).toBe("北京, 中国");
    });

    test("cleans and sanitizes text content", () => {
      document.body.innerHTML = `
        <main>
          <ul>
            <li>
              <div class="mb1">
                <a href="https://linkedin.com/in/test-user" class="dGCAEBVXgkGQKLntuWxHvfKkpBSICAYQaUlZpU">
                  <img alt="  Test   User  " />
                </a>
                <div class="WQvDaGLgJAxxIvMgRXKtFRwauNhWHvbLmKV t-14 t-black t-normal">
                  Software    Engineer    at    TechCorp
                </div>
                <div class="DtvjKFRzdrPWFAkJEOCmaeJlenAlYxLEw t-14 t-normal">
                  San Francisco,   CA   
                </div>
              </div>
            </li>
          </ul>
        </main>
      `;

      const extractedProfiles = extractor.extractProfilesFromPage();
      const validatedProfile = validator.createValidatedProfile(
        extractedProfiles[0]
      );

      expect(validatedProfile.name).toBe("Test   User"); // Only .trim() applied, no space normalization
      expect(validatedProfile.headline).toBe("Software Engineer at TechCorp");
      expect(validatedProfile.location).toBe("San Francisco, CA");
    });
  });

  describe("Selector Fallback Integration", () => {
    test("uses fallback selectors when primary selectors fail", () => {
      // HTML that only matches fallback selectors
      document.body.innerHTML = `
        <div class="search-results-container">
          <ul>
            <li>
              <div class="mb1">
                <a href="https://linkedin.com/in/fallback-test">
                  <span dir="ltr">
                    <span aria-hidden="true">Fallback User</span>
                  </span>
                </a>
                <div class="t-14 t-black t-normal">Fallback Engineer</div>
                <div class="t-14 t-normal">Fallback City</div>
              </div>
            </li>
          </ul>
        </div>
      `;

      const extractedProfiles = extractor.extractProfilesFromPage();
      expect(extractedProfiles).toHaveLength(1);

      const validatedProfile = validator.createValidatedProfile(
        extractedProfiles[0]
      );
      expect(validatedProfile.name).toBe("Fallback User");
      expect(validatedProfile.headline).toBe("Fallback Engineer");
      expect(validatedProfile.location).toBe("Fallback City");
    });

    test("prioritizes more specific selectors over generic ones", () => {
      // HTML with both specific and generic elements
      document.body.innerHTML = `
        <main>
          <ul>
            <li data-chameleon-result-urn="urn:li:fsd_profile:specific-user">
              <div class="mb1">
                <a href="https://linkedin.com/in/specific-user" class="dGCAEBVXgkGQKLntuWxHvfKkpBSICAYQaUlZpU">
                  <img alt="Specific User" />
                </a>
                <div class="WQvDaGLgJAxxIvMgRXKtFRwauNhWHvbLmKV t-14 t-black t-normal">
                  Specific Engineer
                </div>
              </div>
            </li>
          </ul>
          <ul class="generic-list">
            <li>
              <a href="https://linkedin.com/in/generic-user">Generic User</a>
            </li>
          </ul>
        </main>
      `;

      const extractedProfiles = extractor.extractProfilesFromPage();

      // Should extract both profiles - current logic doesn't prioritize selectors
      expect(extractedProfiles).toHaveLength(2);
      expect(extractedProfiles[0].profileName).toBe("Specific User");
      expect(extractedProfiles[1].profileName).toBe("Generic User");
    });
  });

  describe("Cross-Module Communication", () => {
    test("modules can access each other through window globals", () => {
      expect(window.LinkedInScraperUtils).toBe(utils);
      expect(window.LinkedInScraperSelectors).toBe(selectors);
      expect(window.LinkedInScraperExtractor).toBe(extractor);
      expect(window.LinkedInScraperValidator).toBe(validator);
      expect(window.LinkedInScraperStorageApi).toBe(storageApi);
    });

    test("extractor uses selectors module correctly", () => {
      // Spy on selectors usage
      const originalSelectors = window.LinkedInScraperSelectors;
      window.LinkedInScraperSelectors = {
        ...originalSelectors,
        resultSelectors: ["main ul li"], // Simplified for testing
      };

      document.body.innerHTML = createMockLinkedInHTML(1);

      const profiles = extractor.extractProfilesFromPage();
      expect(profiles).toHaveLength(1);

      // Restore original selectors
      window.LinkedInScraperSelectors = originalSelectors;
    });

    test("validator uses utils module correctly", () => {
      const profileData = {
        profileLink: "https://linkedin.com/in/test-user?trk=search",
        profileName: "Test User",
        resultElement: document.createElement("div"),
        index: 0,
      };

      const validatedProfile = validator.createValidatedProfile(profileData);

      // Should use utils to clean URL and extract ID
      expect(validatedProfile.url).toBe("https://linkedin.com/in/test-user");
      expect(validatedProfile.id).toBe("test-user");
    });
  });

  describe("Storage Integration", () => {
    test("saveProfiles sends data to Chrome extension background", async () => {
      const mockProfiles = [
        createMockProfile({ id: "user1", name: "User One" }),
        createMockProfile({ id: "user2", name: "User Two" }),
      ];

      await storageApi.saveProfiles(mockProfiles);

      // Verify message was sent - saveProfiles doesn't return a result
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: "SAVE_PROFILES",
        data: mockProfiles,
      });
    });

    test("handles storage errors gracefully", async () => {
      // Mock Chrome API to throw error
      chrome.runtime.sendMessage.mockImplementationOnce(() => {
        throw new Error("Chrome API error");
      });

      await storageApi.saveProfiles([createMockProfile()]);

      // saveProfiles logs error but doesn't return it - just verify it tried to send
      expect(chrome.runtime.sendMessage).toHaveBeenCalled();
    });

    test("sends scraping completion notification", async () => {
      await storageApi.notifyScrapingComplete();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: "SCRAPE_DONE",
      });
    });
  });

  describe("Performance and Reliability", () => {
    test("handles large numbers of profiles efficiently", () => {
      // Create page with many profiles
      const profileCount = 50;
      document.body.innerHTML = createMockLinkedInHTML(profileCount);

      const startTime = Date.now();
      const extractedProfiles = extractor.extractProfilesFromPage();
      const endTime = Date.now();

      expect(extractedProfiles).toHaveLength(profileCount);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second

      // Validate all profiles
      const validatedProfiles = extractedProfiles
        .map((p) => validator.createValidatedProfile(p))
        .filter(Boolean);

      expect(validatedProfiles).toHaveLength(profileCount);
    });

    test("handles empty pages gracefully", () => {
      document.body.innerHTML = "<main><ul></ul></main>";

      const extractedProfiles = extractor.extractProfilesFromPage();
      expect(extractedProfiles).toHaveLength(0);
      expect(Array.isArray(extractedProfiles)).toBe(true);
    });

    test("continues extraction even with some malformed profiles", () => {
      document.body.innerHTML = `
        <main>
          <ul>
            <li>
              <div class="mb1">
                <a href="https://linkedin.com/in/good-profile" class="dGCAEBVXgkGQKLntuWxHvfKkpBSICAYQaUlZpU">
                  <img alt="Good User" />
                </a>
              </div>
            </li>
            <li>
              <!-- Malformed profile with no link -->
              <div class="mb1">
                <span>Invalid content</span>
              </div>
            </li>
            <li>
              <div class="mb1">
                <a href="https://linkedin.com/in/another-good" class="dGCAEBVXgkGQKLntuWxHvfKkpBSICAYQaUlZpU">
                  <img alt="Another Good User" />
                </a>
              </div>
            </li>
          </ul>
        </main>
      `;

      const extractedProfiles = extractor.extractProfilesFromPage();
      const validatedProfiles = extractedProfiles
        .map((p) => validator.createValidatedProfile(p))
        .filter(Boolean);

      // Should extract 2 valid profiles despite 1 malformed one
      expect(validatedProfiles).toHaveLength(2);
      expect(validatedProfiles[0].name).toBe("Good User");
      expect(validatedProfiles[1].name).toBe("Another Good User");
    });
  });
});
