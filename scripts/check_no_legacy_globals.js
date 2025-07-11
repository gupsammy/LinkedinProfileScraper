const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "..", "src");
// This regex is designed to find legacy globals like `window.LinkedInScraperUtils`
// but ignore the consolidated namespace access like `window.LinkedInScraper.Utils`
const LEGACY_GLOBAL_PATTERN = /window\.LinkedInScraper[A-Z][a-zA-Z]*/g;
// We exclude namespace.js because it's responsible for creating the legacy globals
// for backward compatibility. This check is for *consumers* of the globals.
const ALLOWED_FILES = new Set([path.join(SRC_DIR, "lib", "namespace.js")]);

let legacyGlobalsFound = [];

function searchInFile(filePath) {
  if (ALLOWED_FILES.has(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const matches = content.match(LEGACY_GLOBAL_PATTERN);

  if (matches) {
    matches.forEach((match) => {
      legacyGlobalsFound.push({ file: filePath, usage: match });
    });
  }
}

function traverseDir(dir) {
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      traverseDir(fullPath);
    } else if (fullPath.endsWith(".js")) {
      searchInFile(fullPath);
    }
  });
}

console.log("🔍 Checking for legacy global usage...");
traverseDir(SRC_DIR);

if (legacyGlobalsFound.length > 0) {
  console.error(
    "❌ Found legacy global variables. Please refactor to use the consolidated namespace via `window.LinkedInScraper.getNS(moduleName)`."
  );
  legacyGlobalsFound.forEach((found) => {
    console.error(
      `  - Found '${found.usage}' in ${path.relative(
        process.cwd(),
        found.file
      )}`
    );
  });

  if (process.env.ENFORCE_NO_LEGACY_GLOBALS === "1") {
    console.error(
      "\n🚨 ENFORCE_NO_LEGACY_GLOBALS is enabled. Exiting with error."
    );
    process.exit(1);
  } else {
    console.warn(
      "\n⚠️ To enforce this check in CI, set the environment variable ENFORCE_NO_LEGACY_GLOBALS=1."
    );
    process.exit(0);
  }
} else {
  console.log("✅ No legacy global variables found.");
  process.exit(0);
}
