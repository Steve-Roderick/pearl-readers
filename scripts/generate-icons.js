// Rebuild the local vector logo into installable PNG assets with Playwright.
import { chromium } from "@playwright/test";
import fs from "node:fs";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
try {
  for (const [size, name, maskable] of [
    [192, "icon-192.png", false],
    [512, "icon-512.png", false],
    [512, "maskable-512.png", true],
  ]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    const logo = fs
      .readFileSync("public/favicon.svg", "utf8")
      .replace("<svg ", '<svg width="100%" height="100%" ');
    await page.setContent(
      `<html><body style="margin:0;background:#102d40;width:100vw;height:100vh;display:grid;place-items:center"><div style="width:${maskable ? 70 : 100}%;height:${maskable ? 70 : 100}%">${logo}</div></body></html>`,
    );
    await page.screenshot({ path: `public/icons/${name}` });
    await page.close();
  }
} finally {
  await browser.close();
}
