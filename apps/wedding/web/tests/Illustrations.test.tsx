import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { Chandelier } from '../src/components/Chandelier';
import { ReceptionIllustration } from '../src/components/ReceptionIllustration';

describe('Chandelier & ReceptionIllustration Components', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    // Default: normal motion (prefers-reduced-motion: false)
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  describe('Chandelier Component', () => {
    it('renders with aria-hidden="true" on root and SVG elements for accessibility hygiene', () => {
      const { container } = render(<Chandelier />);
      const root = container.firstElementChild as HTMLElement;

      expect(root).toHaveAttribute('aria-hidden', 'true');

      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThanOrEqual(1);
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('has pointer-events: none to prevent intercepting user interactions', () => {
      const { container } = render(<Chandelier />);
      const root = container.firstElementChild as HTMLElement;

      expect(
        root.classList.contains('pointer-events-none') ||
        root.style.pointerEvents === 'none'
      ).toBe(true);
    });

    it('renders responsive SVG with valid viewBox and aspect ratio settings', () => {
      const { container } = render(<Chandelier />);
      const svg = container.querySelector('svg');

      expect(svg).not.toBeNull();
      const viewBox = svg?.getAttribute('viewBox');
      expect(viewBox).toBeTruthy();
      expect(viewBox).toMatch(/^\d+\s+\d+\s+\d+\s+\d+$/);
    });

    it('employs antique gold color palette tones with layered opacities', () => {
      const { container } = render(<Chandelier />);
      const htmlContent = container.innerHTML;

      // Antique gold palette tones
      const hasPrimaryGold = /#A3894F/i.test(htmlContent);
      const hasGoldHighlight = /#C9B580/i.test(htmlContent);
      const hasGoldShadow = /#7D6633/i.test(htmlContent);

      expect(hasPrimaryGold).toBe(true);
      expect(hasGoldHighlight || hasGoldShadow).toBe(true);

      // Layered opacities for depth
      const layeredElements = container.querySelectorAll('[fill-opacity], [stroke-opacity], [opacity]');
      expect(layeredElements.length).toBeGreaterThanOrEqual(4);
    });

    it('features bespoke candelabra anatomy: arms, crystals, tapers, and candle flames', () => {
      const { container } = render(<Chandelier />);

      const arms = container.querySelectorAll('.chandelier-arm, [data-part="arm"]');
      const crystals = container.querySelectorAll('.chandelier-crystal, [data-part="crystal"]');
      const candles = container.querySelectorAll('.chandelier-candle, [data-part="candle"]');
      const flames = container.querySelectorAll('.chandelier-flame, [data-part="flame"]');

      expect(arms.length).toBeGreaterThanOrEqual(4);
      expect(crystals.length).toBeGreaterThanOrEqual(6);
      expect(candles.length).toBeGreaterThanOrEqual(4);
      expect(flames.length).toBeGreaterThanOrEqual(4);
    });

    it('supports isVisible prop for reveal choreography', () => {
      // Hidden state
      const { container: hiddenContainer } = render(<Chandelier isVisible={false} />);
      const hiddenRoot = hiddenContainer.firstElementChild as HTMLElement;
      const hiddenStyle = hiddenRoot.getAttribute('style') || '';

      const isHiddenOpacity =
        hiddenRoot.classList.contains('opacity-0') ||
        hiddenStyle.includes('opacity: 0') ||
        hiddenStyle.includes('opacity:0');
      expect(isHiddenOpacity).toBe(true);

      // Visible state (default)
      const { container: visibleContainer } = render(<Chandelier isVisible={true} />);
      const visibleRoot = visibleContainer.firstElementChild as HTMLElement;
      const visibleStyle = visibleRoot.getAttribute('style') || '';

      const isVisibleOpacity =
        visibleRoot.classList.contains('opacity-100') ||
        visibleStyle.includes('opacity: 1') ||
        visibleStyle.includes('opacity:1') ||
        !visibleStyle.includes('opacity: 0');
      expect(isVisibleOpacity).toBe(true);
    });

    it('bypasses transforms and motion transitions when reduced motion is preferred', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { container } = render(<Chandelier isVisible={false} />);
      const root = container.firstElementChild as HTMLElement;
      const style = root.getAttribute('style') || '';

      // Upward/downward translation is bypassed
      expect(style).not.toMatch(/translate(?:Y|3d)?\([^)]*-\d+px/i);
      if (style.includes('transition')) {
        expect(style).toMatch(/transition(?:-duration)?:\s*(?:0s|0ms|none)/i);
      }
    });

    it('applies custom className cleanly to root element', () => {
      const { container } = render(<Chandelier className="custom-chandelier-class" />);
      const root = container.firstElementChild as HTMLElement;
      expect(root.classList.contains('custom-chandelier-class')).toBe(true);
    });
  });

  describe('ReceptionIllustration Component', () => {
    it('renders with aria-hidden="true" on root and img elements for accessibility hygiene', () => {
      const { container } = render(<ReceptionIllustration />);
      const root = container.firstElementChild as HTMLElement;

      expect(root).toHaveAttribute('aria-hidden', 'true');

      const img = container.querySelector('img');
      expect(img).not.toBeNull();
      expect(img).toHaveAttribute('aria-hidden', 'true');
    });

    it('has pointer-events: none to avoid intercepting user interactions', () => {
      const { container } = render(<ReceptionIllustration />);
      const root = container.firstElementChild as HTMLElement;

      expect(
        root.classList.contains('pointer-events-none') ||
        root.style.pointerEvents === 'none'
      ).toBe(true);
    });

    it('renders banquet table artwork with responsive image styling and asset path', () => {
      const { container } = render(<ReceptionIllustration />);
      const img = container.querySelector('img');

      expect(img).not.toBeNull();
      expect(img?.getAttribute('src')).toBeTruthy();
      expect(img?.getAttribute('src')).toContain('reception-table');
      expect(img?.classList.contains('pointer-events-none')).toBe(true);
      expect(img?.classList.contains('object-contain')).toBe(true);
    });

    it('supports isVisible prop for reveal choreography', () => {
      // Hidden state
      const { container: hiddenContainer } = render(<ReceptionIllustration isVisible={false} />);
      const hiddenRoot = hiddenContainer.firstElementChild as HTMLElement;
      const hiddenStyle = hiddenRoot.getAttribute('style') || '';

      const isHiddenOpacity =
        hiddenRoot.classList.contains('opacity-0') ||
        hiddenStyle.includes('opacity: 0') ||
        hiddenStyle.includes('opacity:0');
      expect(isHiddenOpacity).toBe(true);

      // Visible state (default)
      const { container: visibleContainer } = render(<ReceptionIllustration isVisible={true} />);
      const visibleRoot = visibleContainer.firstElementChild as HTMLElement;
      const visibleStyle = visibleRoot.getAttribute('style') || '';

      const isVisibleOpacity =
        visibleRoot.classList.contains('opacity-100') ||
        visibleStyle.includes('opacity: 1') ||
        visibleStyle.includes('opacity:1') ||
        !visibleStyle.includes('opacity: 0');
      expect(isVisibleOpacity).toBe(true);
    });

    it('bypasses transforms and motion transitions when reduced motion is preferred', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { container } = render(<ReceptionIllustration isVisible={false} />);
      const root = container.firstElementChild as HTMLElement;
      const style = root.getAttribute('style') || '';

      // Translation offset is bypassed in reduced motion
      expect(style).not.toMatch(/translate(?:Y|3d)?\([^)]*\d+px/i);
      if (style.includes('transition')) {
        expect(style).toMatch(/transition(?:-duration)?:\s*(?:0s|0ms|none)/i);
      }
    });

    it('applies custom className cleanly to root element', () => {
      const { container } = render(<ReceptionIllustration className="custom-reception-class" />);
      const root = container.firstElementChild as HTMLElement;
      expect(root.classList.contains('custom-reception-class')).toBe(true);
    });
  });
});
