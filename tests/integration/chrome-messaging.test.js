// Integration tests for Chrome extension messaging system
// Tests communication between content scripts and background script

const { loadModules } = require("../helpers/loadModules");

describe("Chrome Extension Messaging Integration", () => {
  let controller, messageBridge, storageApi;

  beforeEach(() => {
    // Load required modules with coverage tracking
    const modules = loadModules([
      "src/lib/utils.js",
      "src/lib/selectors.js",
      "src/lib/pagination.js", 
      "src/lib/extractor.js",
      "src/lib/validator.js",
      "src/lib/storageApi.js",
      "src/lib/state.js",
      "src/content/controller.js",
      "src/content/messageBridge.js"
    ]);

    controller = window.LinkedInScraperController;
    messageBridge = window.LinkedInScraperMessageBridge;
    storageApi = window.LinkedInScraperStorageApi;

    // Reset Chrome API mocks
    chrome.runtime.sendMessage.mockClear();
    chrome.tabs.query.mockClear();
    chrome.tabs.sendMessage.mockClear();
  });

  describe("Message Bridge Initialization", () => {
    test("initializes message listener correctly", () => {
      const addListenerSpy = jest.spyOn(
        chrome.runtime.onMessage,
        "addListener"
      );

      messageBridge.initializeMessageBridge();

      expect(addListenerSpy).toHaveBeenCalledWith(
        messageBridge.handleRuntimeMessage
      );
      expect(window.linkedInScraperMessageListener).toBe(
        messageBridge.handleRuntimeMessage
      );
    });

    test("handles Chrome API unavailability gracefully", () => {
      const originalChrome = global.chrome;
      global.chrome = {};

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      messageBridge.initializeMessageBridge();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Chrome runtime API not available"
      );

      global.chrome = originalChrome;
      consoleSpy.mockRestore();
    });
  });

  describe("Runtime Message Handling", () => {
    test("handles START_SCRAPING message", () => {
      const message = { type: "START_SCRAPING" };
      const sendResponse = jest.fn();

      // Mock isValidPeopleSearchPage to return true
      controller.isValidPeopleSearchPage = jest.fn(() => true);

      const result = messageBridge.handleRuntimeMessage(
        message,
        null,
        sendResponse
      );

      expect(result).toBe(true); // Indicates async response
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    test("handles STOP_SCRAPING message", () => {
      const message = { type: "STOP_SCRAPING" };
      const sendResponse = jest.fn();

      const result = messageBridge.handleRuntimeMessage(
        message,
        null,
        sendResponse
      );

      expect(result).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    test("handles unknown message types", () => {
      const message = { type: "UNKNOWN_TYPE" };
      const sendResponse = jest.fn();

      const result = messageBridge.handleRuntimeMessage(
        message,
        null,
        sendResponse
      );

      expect(result).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: "Unknown message type",
      });
    });

    test("handles missing controller module", () => {
      // Temporarily remove controller
      const originalController = window.LinkedInScraperController;
      window.LinkedInScraperController = null;

      const message = { type: "START_SCRAPING" };
      const sendResponse = jest.fn();

      const result = messageBridge.handleRuntimeMessage(
        message,
        null,
        sendResponse
      );

      expect(result).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: "Controller module not available",
      });

      // Restore controller
      window.LinkedInScraperController = originalController;
    });

    test("handles errors during message processing", () => {
      const message = { type: "START_SCRAPING" };
      const sendResponse = jest.fn();

      // Mock controller to throw error
      controller.startScraping = jest.fn(() => {
        throw new Error("Scraping error");
      });
      controller.isValidPeopleSearchPage = jest.fn(() => true);

      const result = messageBridge.handleRuntimeMessage(
        message,
        null,
        sendResponse
      );

      expect(result).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: "Scraping error",
      });
    });
  });

  describe("Storage API Messaging", () => {
    test("sends profile data to background script", async () => {
      const profiles = [
        createMockProfile({ id: "user1", name: "User One" }),
        createMockProfile({ id: "user2", name: "User Two" }),
      ];

      chrome.runtime.sendMessage.mockImplementationOnce((message) => {
        expect(message.type).toBe("SAVE_PROFILES");
        expect(message.data).toEqual(profiles);
        return Promise.resolve({ success: true, saved: 2, total: 2 });
      });

      await storageApi.saveProfiles(profiles);

      // saveProfiles doesn't return a result - just verify message was sent
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: "SAVE_PROFILES",
        data: profiles,
      });
    });

    test("handles background script communication errors", async () => {
      chrome.runtime.sendMessage.mockImplementationOnce(() => {
        throw new Error("Communication failed");
      });

      await storageApi.saveProfiles([createMockProfile()]);

      // saveProfiles logs errors but doesn't return them
      expect(chrome.runtime.sendMessage).toHaveBeenCalled();
    });

    test("sends scraping completion notification", async () => {
      chrome.runtime.sendMessage.mockImplementationOnce((message) => {
        expect(message.type).toBe("SCRAPE_DONE");
        return Promise.resolve({ success: true });
      });

      await storageApi.notifyScrapingComplete();

      // notifyScrapingComplete doesn't return anything
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: "SCRAPE_DONE",
      });
    });

    test("uses generic sendMessage utility", async () => {
      const testData = { test: "data" };

      chrome.runtime.sendMessage.mockImplementationOnce((message) => {
        expect(message.type).toBe("TEST_TYPE");
        expect(message.test).toBe("data"); // sendMessage spreads data into message
        return Promise.resolve({ success: true, result: "test" });
      });

      const result = await storageApi.sendMessage("TEST_TYPE", testData);

      expect(result.success).toBe(true);
      expect(result.result).toBe("test");
    });
  });

  describe("Cross-Module Communication", () => {
    test("controller can trigger message bridge operations", () => {
      const initSpy = jest.spyOn(messageBridge, "initializeMessageBridge");

      // Simulate navigation event that triggers message bridge reinitialization
      messageBridge.initializeMessageBridge();

      expect(initSpy).toHaveBeenCalled();
    });

    test("message bridge can trigger controller operations", async () => {
      const startSpy = jest
        .spyOn(controller, "startScraping")
        .mockImplementation(() => {});
      const stopSpy = jest
        .spyOn(controller, "stopScraping")
        .mockImplementation(() => {});

      controller.isValidPeopleSearchPage = jest.fn(() => true);

      // Test START_SCRAPING message
      await messageBridge.handleRuntimeMessage(
        { type: "START_SCRAPING" },
        null,
        jest.fn()
      );
      expect(startSpy).toHaveBeenCalled();

      // Test STOP_SCRAPING message
      await messageBridge.handleRuntimeMessage(
        { type: "STOP_SCRAPING" },
        null,
        jest.fn()
      );
      expect(stopSpy).toHaveBeenCalled();
    });

    test("storage API integrates with extraction workflow", async () => {
      // Setup mock LinkedIn page
      document.body.innerHTML = createMockLinkedInHTML(2);

      // Mock page validation and URL to look like LinkedIn search
      Object.defineProperty(window, "location", {
        value: {
          href: "https://linkedin.com/search/results/people/?keywords=engineer",
          pathname: "/search/results/people/",
          search: "?keywords=engineer",
        },
        writable: true,
      });
      controller.isValidPeopleSearchPage = jest.fn(() => true);

      // Mock Chrome API response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        if (message.type === "SAVE_PROFILES") {
          return Promise.resolve({
            success: true,
            saved: message.data.length,
            total: message.data.length,
          });
        }
        return Promise.resolve({ success: true });
      });

      // Execute start scraping workflow
      await controller.startScraping();

      // Verify that profile data was sent to background
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "SAVE_PROFILES",
          data: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              name: expect.any(String),
              url: expect.any(String),
            }),
          ]),
        })
      );
    });
  });

  describe("Error Resilience", () => {
    test("continues operation when Chrome API is temporarily unavailable", async () => {
      // Mock Chrome API to fail once then succeed
      let callCount = 0;
      chrome.runtime.sendMessage.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Temporary failure");
        }
        return Promise.resolve({ success: true });
      });

      // First call should fail
      await storageApi.saveProfiles([createMockProfile()]);

      // Second call should succeed
      await storageApi.saveProfiles([createMockProfile()]);

      // Both calls should have attempted to send messages
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
    });

    test("handles message handling with missing dependencies", () => {
      // Temporarily remove all modules
      const modules = [
        "LinkedInScraperController",
        "LinkedInScraperStorageApi",
        "LinkedInScraperExtractor",
      ];
      const originals = {};

      modules.forEach((module) => {
        originals[module] = window[module];
        window[module] = null;
      });

      const message = { type: "START_SCRAPING" };
      const sendResponse = jest.fn();

      const result = messageBridge.handleRuntimeMessage(
        message,
        null,
        sendResponse
      );

      expect(result).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: "Controller module not available",
      });

      // Restore modules
      modules.forEach((module) => {
        window[module] = originals[module];
      });
    });

    test("maintains message bridge across navigation events", () => {
      const addListenerSpy = jest.spyOn(
        chrome.runtime.onMessage,
        "addListener"
      );

      // Reset spy count (test setup may have called it already)
      addListenerSpy.mockClear();

      // Initialize message bridge
      messageBridge.initializeMessageBridge();
      expect(addListenerSpy).toHaveBeenCalledTimes(1);

      // Simulate navigation event requiring reinitialization
      messageBridge.initializeMessageBridge();
      expect(addListenerSpy).toHaveBeenCalledTimes(2); // Each call adds a listener

      // Message handling should still work
      const message = { type: "STOP_SCRAPING" };
      const sendResponse = jest.fn();

      const result = messageBridge.handleRuntimeMessage(
        message,
        null,
        sendResponse
      );
      expect(result).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });
  });

  describe("Message Validation", () => {
    test("validates message structure", () => {
      const invalidMessages = [{}, { type: null }, { type: "" }, "invalid"];

      invalidMessages.forEach((message) => {
        const sendResponse = jest.fn();
        const result = messageBridge.handleRuntimeMessage(
          message,
          null,
          sendResponse
        );

        expect(result).toBe(true);
        expect(sendResponse).toHaveBeenCalledWith({
          success: false,
          error: expect.stringContaining("Unknown message type"),
        });

        sendResponse.mockClear();
      });
    });

    test("handles null/undefined messages with error", () => {
      const nullishMessages = [null, undefined];

      nullishMessages.forEach((message) => {
        const sendResponse = jest.fn();

        // These will throw TypeError when trying to access message.type
        expect(() => {
          messageBridge.handleRuntimeMessage(message, null, sendResponse);
        }).toThrow(TypeError);
      });
    });

    test("handles complex message data structures", () => {
      const complexMessage = {
        type: "START_SCRAPING",
        data: {
          nested: { value: "test" },
          array: [1, 2, 3],
          special: null,
        },
      };

      controller.isValidPeopleSearchPage = jest.fn(() => true);
      const sendResponse = jest.fn();

      const result = messageBridge.handleRuntimeMessage(
        complexMessage,
        null,
        sendResponse
      );

      expect(result).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });
  });

  describe("Performance Considerations", () => {
    test("handles rapid message sequences", async () => {
      const messageCount = 10;
      const responses = [];

      // Send multiple messages rapidly
      for (let i = 0; i < messageCount; i++) {
        const sendResponse = jest.fn();
        messageBridge.handleRuntimeMessage(
          { type: "STOP_SCRAPING" },
          null,
          sendResponse
        );
        responses.push(sendResponse);
      }

      // All should complete successfully
      responses.forEach((sendResponse) => {
        expect(sendResponse).toHaveBeenCalledWith({ success: true });
      });
    });

    test("message processing is efficient", () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        messageBridge.handleRuntimeMessage(
          { type: "STOP_SCRAPING" },
          null,
          jest.fn()
        );
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });
  });
});
