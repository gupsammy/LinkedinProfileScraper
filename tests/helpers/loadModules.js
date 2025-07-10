// Simple module loader for Jest coverage tracking
// Loads browser modules while maintaining Jest code coverage

/**
 * Load a LinkedIn scraper module for testing with coverage tracking
 * @param {string} modulePath - Path to module relative to project root
 * @returns {Object} The module's exports from window
 */
function loadModule(modulePath) {
  // Get the absolute path for clearing require cache
  const absolutePath = require.resolve('../../' + modulePath);
  
  // Clear require cache to ensure fresh load
  delete require.cache[absolutePath];
  
  // Store existing modules before loading
  const existingModules = Object.keys(window).filter(k => k.startsWith('LinkedInScraper'));
  
  // Require the module directly - this will execute it and set window globals
  // Jest will track this as a real require() for coverage
  require('../../' + modulePath);
  
  // Find the new module that was just loaded
  const newModules = Object.keys(window).filter(k => k.startsWith('LinkedInScraper') && !existingModules.includes(k));
  
  if (newModules.length === 0) {
    // Maybe the module was already loaded, try to find any module
    const allModules = Object.keys(window).filter(k => k.startsWith('LinkedInScraper'));
    if (allModules.length > 0) {
      return window[allModules[0]]; // Return the first available module
    }
    
    console.error(`No LinkedInScraper modules found on window after loading ${modulePath}`);
    console.error('Available window keys:', Object.keys(window).filter(k => k.includes('Scraper')));
    throw new Error(`Module ${modulePath} did not export to window`);
  }
  
  const loadedModule = window[newModules[0]];
  
  if (!loadedModule) {
    throw new Error(`Module ${modulePath} did not export to window`);
  }
  
  return loadedModule;
}

/**
 * Load multiple modules in dependency order
 * @param {string[]} modulePaths - Paths to modules in dependency order
 * @returns {Object} Object with module names as keys
 */
function loadModules(modulePaths) {
  // Clear all existing window globals first
  Object.keys(window).forEach(key => {
    if (key.startsWith('LinkedInScraper')) {
      delete window[key];
    }
  });
  
  const modules = {};
  
  // Load each module in order
  modulePaths.forEach((modulePath, index) => {
    console.log(`Loading module ${index + 1}/${modulePaths.length}: ${modulePath}`);
    const beforeKeys = new Set(Object.keys(window).filter(k => k.startsWith('LinkedInScraper')));
    console.log(`  Before keys:`, Array.from(beforeKeys));
    
    // Try multiple approaches to clear the cache
    const absolutePath = require.resolve('../../' + modulePath);
    
    // Force clear require cache - try multiple approaches
    delete require.cache[absolutePath];
    
    // For Jest, also try clearing the module from the internal cache
    if (require.cache[absolutePath]) {
      console.log(`  Cache still exists after delete, forcing clear...`);
      // Set to undefined first, then delete
      require.cache[absolutePath] = undefined;
      delete require.cache[absolutePath];
    }
    
    // Require the module
    require('../../' + modulePath);
    
    // Check if the module was loaded to window
    const afterKeys = Object.keys(window).filter(k => k.startsWith('LinkedInScraper'));
    const newKeys = afterKeys.filter(k => !beforeKeys.has(k));
    console.log(`  After keys:`, afterKeys);
    console.log(`  New keys:`, newKeys);
    
    // If no new keys, but we know this module should export something, force it
    if (newKeys.length === 0) {
      console.log(`  No new keys found for ${modulePath}`);
      
      // For utils.js specifically, check if it's a caching issue
      if (modulePath.includes('utils.js') && !window.LinkedInScraperUtils) {
        console.log(`  Utils module not loaded, trying eval approach...`);
        // As a last resort, read the file and eval it
        const fs = require('fs');
        const path = require('path');
        try {
          const fullPath = path.resolve(__dirname, '../../' + modulePath);
          const moduleCode = fs.readFileSync(fullPath, 'utf8');
          eval(moduleCode);
          console.log(`  Eval approach result:`, !!window.LinkedInScraperUtils);
        } catch (e) {
          console.log(`  Eval approach failed:`, e.message);
        }
      }
      
      // Check again after potential eval
      const finalKeys = Object.keys(window).filter(k => k.startsWith('LinkedInScraper'));
      const finalNewKeys = finalKeys.filter(k => !beforeKeys.has(k));
      
      if (finalNewKeys.length > 0) {
        const moduleName = finalNewKeys[0];
        modules[moduleName] = window[moduleName];
        console.log(`  Added to modules (after eval):`, moduleName);
      } else {
        console.log(`  Still no new keys, checking fallback...`);
        // Fallback: if no new keys found, add any existing modules
        afterKeys.forEach(key => {
          if (!modules[key] && window[key]) {
            modules[key] = window[key];
            console.log(`  Added via fallback:`, key);
          }
        });
      }
    } else {
      const moduleName = newKeys[0];
      modules[moduleName] = window[moduleName];
      console.log(`  Added to modules:`, moduleName);
    }
  });
  
  return modules;
}

/**
 * Standard dependency order for LinkedIn scraper modules
 */
const MODULE_LOAD_ORDER = [
  'src/lib/utils.js',
  'src/lib/selectors.js',
  'src/lib/extractor.js', 
  'src/lib/validator.js',
  'src/lib/pagination.js',
  'src/lib/state.js',
  'src/lib/storageApi.js',
  'src/content/controller.js',
  'src/content/messageBridge.js',
  'src/content/entry.js'
];

/**
 * Load all modules in correct dependency order
 * @returns {Object} All loaded modules
 */
function loadAllModules() {
  return loadModules(MODULE_LOAD_ORDER);
}

/**
 * Load just the lib modules (most commonly needed for testing)
 * @returns {Object} Lib modules only
 */
function loadLibModules() {
  const libModules = MODULE_LOAD_ORDER.filter(path => path.includes('src/lib/'));
  return loadModules(libModules);
}

module.exports = {
  loadModule,
  loadModules,
  loadAllModules,
  loadLibModules,
  MODULE_LOAD_ORDER
};