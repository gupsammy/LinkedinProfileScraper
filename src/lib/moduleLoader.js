// Enhanced module loading system with retry logic and graceful failure handling
// Improves reliability of Chrome extension module loading

class ModuleLoader {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
    this.exponentialBackoff = true;
    this.requiredModules = [
      'LinkedInScraperUtils',
      'LinkedInScraperSelectors', 
      'LinkedInScraperPagination',
      'LinkedInScraperExtractor',
      'LinkedInScraperValidator',
      'LinkedInScraperStorageApi',
      'LinkedInScraperState',
      'LinkedInScraperController',
      'LinkedInScraperMessageBridge'
    ];
    this.loadAttempts = 0;
    this.failureReasons = [];
  }

  // Main entry point for module loading with retry logic
  async loadModulesWithRetry() {
    console.log('🔄 Starting enhanced module loading...');
    
    for (this.loadAttempts = 1; this.loadAttempts <= this.maxRetries; this.loadAttempts++) {
      console.log(`📦 Module loading attempt ${this.loadAttempts}/${this.maxRetries}`);
      
      const result = await this.checkModuleAvailability();
      
      if (result.success) {
        console.log('✅ All modules loaded successfully!');
        return result;
      }
      
      // Log failure reason for this attempt
      this.failureReasons.push({
        attempt: this.loadAttempts,
        missingModules: result.missingModules,
        timestamp: new Date().toISOString()
      });
      
      if (this.loadAttempts < this.maxRetries) {
        const delay = this.calculateRetryDelay();
        console.warn(`⚠️ Attempt ${this.loadAttempts} failed. Retrying in ${delay}ms...`);
        console.warn(`Missing modules: ${result.missingModules.join(', ')}`);
        
        await this.sleep(delay);
        
        // Try to reload failed modules
        await this.attemptModuleReload(result.missingModules);
      }
    }
    
    // All attempts failed
    return this.handleLoadFailure();
  }

  // Check module availability with detailed reporting
  async checkModuleAvailability() {
    const missingModules = [];
    const availableModules = [];
    const partialModules = [];
    
    this.requiredModules.forEach((moduleName) => {
      const module = window[moduleName];
      
      if (!module) {
        missingModules.push(moduleName);
      } else if (typeof module === 'object' && Object.keys(module).length === 0) {
        partialModules.push(moduleName);
      } else {
        availableModules.push(moduleName);
      }
    });
    
    const success = missingModules.length === 0 && partialModules.length === 0;
    
    if (success) {
      console.log(`✅ Module check passed: ${availableModules.length}/${this.requiredModules.length} modules available`);
    } else {
      console.warn(`❌ Module check failed:`);
      if (missingModules.length > 0) {
        console.warn(`  Missing: ${missingModules.join(', ')}`);
      }
      if (partialModules.length > 0) {
        console.warn(`  Partial/Empty: ${partialModules.join(', ')}`);
      }
    }
    
    return {
      success,
      availableModules,
      missingModules: [...missingModules, ...partialModules],
      totalModules: this.requiredModules.length,
      loadAttempt: this.loadAttempts
    };
  }

  // Attempt to reload specific failed modules
  async attemptModuleReload(failedModules) {
    console.log(`🔧 Attempting to reload ${failedModules.length} failed modules...`);
    
    // Wait a bit longer for async module loading
    await this.sleep(500);
    
    // Note: Removed forced garbage collection to prevent performance issues
    // gc() can cause noticeable pauses and is not necessary for normal operation
    
    // Trigger a document event that might help with module loading
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new Event('moduleReloadAttempt'));
    }
  }

  // Calculate retry delay with exponential backoff
  calculateRetryDelay() {
    if (this.exponentialBackoff) {
      return this.retryDelay * Math.pow(2, this.loadAttempts - 1);
    }
    return this.retryDelay;
  }

  // Handle complete loading failure with graceful degradation
  handleLoadFailure() {
    console.error('❌ Module loading failed after all retry attempts');
    console.error('📊 Failure summary:', this.failureReasons);
    
    const lastFailure = this.failureReasons[this.failureReasons.length - 1];
    const criticalModules = this.identifyCriticalModules(lastFailure.missingModules);
    
    // Attempt graceful degradation
    if (criticalModules.length === 0) {
      console.log('🎯 No critical modules missing, attempting graceful degradation...');
      return this.attemptGracefulDegradation(lastFailure.missingModules);
    }
    
    // Show user-friendly error message
    this.showUserErrorMessage(lastFailure.missingModules);
    
    // Report to background script for debugging
    this.reportLoadFailureToBackground();
    
    return {
      success: false,
      error: 'Module loading failed',
      missingModules: lastFailure.missingModules,
      criticalFailure: criticalModules.length > 0,
      failureReasons: this.failureReasons
    };
  }

  // Identify which modules are critical for basic functionality
  identifyCriticalModules(missingModules) {
    const critical = [
      'LinkedInScraperUtils',
      'LinkedInScraperController',
      'LinkedInScraperMessageBridge'
    ];
    
    return missingModules.filter(module => critical.includes(module));
  }

  // Attempt to run with reduced functionality
  attemptGracefulDegradation(missingModules) {
    console.log('🔄 Attempting graceful degradation...');
    
    // Check if core functionality is available
    const hasUtils = window.LinkedInScraperUtils;
    const hasController = window.LinkedInScraperController;
    const hasMessageBridge = window.LinkedInScraperMessageBridge;
    
    if (hasUtils && hasController && hasMessageBridge) {
      console.log('✅ Core modules available, enabling limited functionality');
      
      // Initialize message bridge at minimum
      if (hasMessageBridge.initializeMessageBridge) {
        hasMessageBridge.initializeMessageBridge();
      }
      
      return {
        success: true,
        degraded: true,
        availableFunctionality: ['message_handling'],
        missingModules,
        warning: 'Extension running with limited functionality'
      };
    }
    
    console.error('❌ Critical modules missing, cannot provide graceful degradation');
    return {
      success: false,
      error: 'Critical module failure',
      missingModules
    };
  }

  // Show user-friendly error message
  showUserErrorMessage(missingModules) {
    if (typeof document !== 'undefined') {
      // Check if error message already exists to avoid duplicates
      const existingError = document.getElementById('linkedin-scraper-error');
      if (existingError) {
        console.log('Error message already displayed, skipping duplicate');
        return;
      }

      const errorDiv = document.createElement('div');
      errorDiv.id = 'linkedin-scraper-error';
      errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff4757;
        color: white;
        padding: 15px;
        border-radius: 5px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 2147483647;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        pointer-events: auto;
      `;
      
      errorDiv.innerHTML = `
        <strong>LinkedIn Scraper Error</strong><br>
        Extension failed to load properly. Try refreshing the page.<br>
        <small>Missing: ${missingModules.slice(0, 3).join(', ')}${missingModules.length > 3 ? '...' : ''}</small>
      `;
      
      document.body.appendChild(errorDiv);
      
      // Store timeout reference for cleanup
      const timeoutId = setTimeout(() => {
        if (errorDiv.parentNode) {
          errorDiv.parentNode.removeChild(errorDiv);
        }
      }, 10000);

      // Store timeout reference on the element for potential cleanup
      errorDiv._timeoutId = timeoutId;
    }
  }

  // Report failure to background script for debugging
  reportLoadFailureToBackground() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        chrome.runtime.sendMessage({
          type: 'MODULE_LOAD_FAILURE',
          data: {
            url: window.location.href,
            failureReasons: this.failureReasons,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('Failed to report module load failure:', error);
      }
    }
  }

  // Utility sleep function
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get loading statistics for debugging
  getLoadingStats() {
    return {
      attempts: this.loadAttempts,
      maxRetries: this.maxRetries,
      failureReasons: this.failureReasons,
      requiredModules: this.requiredModules
    };
  }
}

// Create and export singleton instance
const moduleLoader = new ModuleLoader();

// Export for use in other modules
window.LinkedInScraperModuleLoader = moduleLoader;

console.log('moduleLoader.js module loaded');