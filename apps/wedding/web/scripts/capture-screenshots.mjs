import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const SCREENSHOTS_DIR = '/workspaces/megalith/.superpowers/sdd/2026-10-13-wedding-invitation/screenshots';
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (e) {
      // wait
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}

async function main() {
  console.log('Starting preview server...');
  const server = spawn('pnpm', ['--dir', '/workspaces/megalith/apps/wedding/web', 'run', 'preview', '--port', '4173'], {
    stdio: 'inherit',
    detached: true,
  });

  const url = 'http://localhost:4173';

  try {
    await waitForServer(url);
    console.log('Preview server is up at ' + url);

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
    });

    // 1. Mobile screenshots (390 x 844)
    console.log('Capturing mobile screenshots (390x844)...');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(url, { waitUntil: 'networkidle' });

    // Explicitly select PT to ensure Portuguese locale
    const ptButton = mobilePage.locator('.language-switcher-btn:has-text("PT")');
    await ptButton.click();
    await mobilePage.waitForTimeout(3200);

    // Mobile PT
    const mobilePtPath = path.join(SCREENSHOTS_DIR, 'hero-mobile-pt.png');
    await mobilePage.screenshot({ path: mobilePtPath, fullPage: false });
    console.log(`Saved: ${mobilePtPath}`);

    // Switch to EN
    const enButton = mobilePage.locator('.language-switcher-btn:has-text("EN")');
    await enButton.click();
    await mobilePage.waitForTimeout(600);
    const mobileEnPath = path.join(SCREENSHOTS_DIR, 'hero-mobile-en.png');
    await mobilePage.screenshot({ path: mobileEnPath, fullPage: false });
    console.log(`Saved: ${mobileEnPath}`);

    // Switch to FR
    const frButton = mobilePage.locator('.language-switcher-btn:has-text("FR")');
    await frButton.click();
    await mobilePage.waitForTimeout(600);
    const mobileFrPath = path.join(SCREENSHOTS_DIR, 'hero-mobile-fr.png');
    await mobilePage.screenshot({ path: mobileFrPath, fullPage: false });
    console.log(`Saved: ${mobileFrPath}`);

    await mobileContext.close();

    // 2. Desktop screenshot (1280 x 800)
    console.log('Capturing desktop screenshot (1280x800)...');
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
    });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto(url, { waitUntil: 'networkidle' });

    // Explicitly select PT for desktop Portuguese screenshot
    const desktopPtButton = desktopPage.locator('.language-switcher-btn:has-text("PT")');
    await desktopPtButton.click();
    await desktopPage.waitForTimeout(3200);

    const desktopPtPath = path.join(SCREENSHOTS_DIR, 'hero-desktop-pt.png');
    await desktopPage.screenshot({ path: desktopPtPath, fullPage: false });
    console.log(`Saved: ${desktopPtPath}`);

    await desktopContext.close();
    await browser.close();
    console.log('All screenshots captured successfully!');
  } finally {
    try {
      process.kill(-server.pid);
    } catch (e) {
      server.kill();
    }
  }
}

main().catch((err) => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
