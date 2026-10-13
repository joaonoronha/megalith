import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const SCREENSHOTS_DIR = '/workspaces/megalith/.superpowers/sdd/2026-10-13-wedding-invitation/screenshots';
const ARTIFACTS_SCREENSHOTS_DIR = '/home/codespace/.gemini/antigravity-cli/brain/12303d6b-a952-42e1-9926-e1aab7cc74fc/screenshots';
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
fs.mkdirSync(ARTIFACTS_SCREENSHOTS_DIR, { recursive: true });

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

function saveToBoth(filename, buffer) {
  fs.writeFileSync(path.join(SCREENSHOTS_DIR, filename), buffer);
  fs.writeFileSync(path.join(ARTIFACTS_SCREENSHOTS_DIR, filename), buffer);
  console.log(`Saved: ${filename} to both directories`);
}

async function main() {
  console.log('Building latest frontend before preview...');
  // Ensure fresh build exists
  const buildProc = spawn('pnpm', ['--dir', '/workspaces/megalith/apps/wedding/web', 'run', 'build'], {
    stdio: 'inherit',
  });
  await new Promise((resolve, reject) => {
    buildProc.on('close', (code) => (code === 0 ? resolve() : reject(new Error('Build failed'))));
  });

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

    // 1. Mobile 375px Viewport (iPhone SE / Standard Compact)
    console.log('Capturing mobile 375px screenshots...');
    const ctx375 = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 2,
    });
    const page375 = await ctx375.newPage();
    await page375.goto(url, { waitUntil: 'networkidle' });

    const ptBtn375 = page375.locator('.language-switcher-btn:has-text("PT")');
    await ptBtn375.click();
    await page375.waitForTimeout(3200);

    // Hero viewport
    saveToBoth('hero-mobile-375-pt.png', await page375.screenshot({ fullPage: false }));
    // Full page scroll
    saveToBoth('fullpage-mobile-375-pt.png', await page375.screenshot({ fullPage: true }));

    // Switch to EN
    const enBtn375 = page375.locator('.language-switcher-btn:has-text("EN")');
    await enBtn375.click();
    await page375.waitForTimeout(600);
    saveToBoth('hero-mobile-375-en.png', await page375.screenshot({ fullPage: false }));

    // Switch to FR
    const frBtn375 = page375.locator('.language-switcher-btn:has-text("FR")');
    await frBtn375.click();
    await page375.waitForTimeout(600);
    saveToBoth('hero-mobile-375-fr.png', await page375.screenshot({ fullPage: false }));
    await ctx375.close();

    // 2. Mobile 430px Viewport (iPhone 15 Pro Max / Large Mobile)
    console.log('Capturing mobile 430px screenshots...');
    const ctx430 = await browser.newContext({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 2,
    });
    const page430 = await ctx430.newPage();
    await page430.goto(url, { waitUntil: 'networkidle' });
    const ptBtn430 = page430.locator('.language-switcher-btn:has-text("PT")');
    await ptBtn430.click();
    await page430.waitForTimeout(3200);

    saveToBoth('hero-mobile-430-pt.png', await page430.screenshot({ fullPage: false }));
    saveToBoth('fullpage-mobile-430-pt.png', await page430.screenshot({ fullPage: true }));
    await ctx430.close();

    // 3. Desktop 1280px Viewport
    console.log('Capturing desktop 1280px screenshots...');
    const desktopCtx = await browser.newContext({
      viewport: { width: 1280, height: 850 },
      deviceScaleFactor: 2,
    });
    const desktopPage = await desktopCtx.newPage();
    await desktopPage.goto(url, { waitUntil: 'networkidle' });
    const desktopPtBtn = desktopPage.locator('.language-switcher-btn:has-text("PT")');
    await desktopPtBtn.click();
    await desktopPage.waitForTimeout(3200);

    saveToBoth('hero-desktop-1280-pt.png', await desktopPage.screenshot({ fullPage: false }));
    saveToBoth('fullpage-desktop-1280-pt.png', await desktopPage.screenshot({ fullPage: true }));
    await desktopCtx.close();

    await browser.close();
    console.log('All responsive screenshots captured and saved successfully!');
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
