import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Deployment Artifacts & Configuration', () => {
  it('has public/CNAME containing canonical domain', () => {
    const cnamePath = path.resolve(__dirname, '../public/CNAME');
    expect(fs.existsSync(cnamePath)).toBe(true);
    const content = fs.readFileSync(cnamePath, 'utf-8').trim();
    expect(content).toBe('madalenaejoao.pt');
  });

  it('has public/404.html for SPA redirect fallback', () => {
    const fallbackPath = path.resolve(__dirname, '../public/404.html');
    expect(fs.existsSync(fallbackPath)).toBe(true);
    const content = fs.readFileSync(fallbackPath, 'utf-8');
    expect(content).toContain('location.replace');
  });
});
