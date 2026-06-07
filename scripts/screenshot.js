const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const FILE_URL = "file:///C:/Users/Admin/Documents/spdv4/index.html";
const debugDir = path.join(__dirname, "..", "debug");

(async () => {
  if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto(FILE_URL, { waitUntil: "networkidle" });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const screenshotPath = path.join(debugDir, `screenshot-${timestamp}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  console.log(`Saved: ${screenshotPath}`);
  await browser.close();
})();
