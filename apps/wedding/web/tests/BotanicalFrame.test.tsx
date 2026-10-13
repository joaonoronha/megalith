import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { BotanicalFrame } from '../src/components/BotanicalFrame';
import { PaperTexture } from '../src/components/PaperTexture';

describe('BotanicalFrame & PaperTexture Components', () => {
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

  describe('BotanicalFrame Component', () => {
    it('renders with aria-hidden="true" on root and SVG elements for screen reader hygiene', () => {
      const { container } = render(<BotanicalFrame />);
      const root = container.firstElementChild as HTMLElement;

      expect(root).toHaveAttribute('aria-hidden', 'true');

      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThanOrEqual(1);
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('has pointer-events: none to avoid intercepting user interactions', () => {
      const { container } = render(<BotanicalFrame />);
      const root = container.firstElementChild as HTMLElement;

      expect(
        root.classList.contains('pointer-events-none') ||
        root.style.pointerEvents === 'none'
      ).toBe(true);
    });

    it('renders responsive SVG viewboxes with cascading left and right botanical canopies', () => {
      const { container } = render(<BotanicalFrame />);

      const leftCanopy = container.querySelector('.botanical-canopy-left, [data-canopy="left"]');
      const rightCanopy = container.querySelector('.botanical-canopy-right, [data-canopy="right"]');

      expect(leftCanopy).toBeInTheDocument();
      expect(rightCanopy).toBeInTheDocument();

      const svgs = container.querySelectorAll('svg');
      svgs.forEach((svg) => {
        const viewBox = svg.getAttribute('viewBox');
        expect(viewBox).toBeTruthy();
        expect(viewBox).toMatch(/^\d+\s+\d+\s+\d+\s+\d+$/);
      });
    });

    it('contains bespoke olive foliage anatomy: stems, veined leaves, and bud details', () => {
      const { container } = render(<BotanicalFrame />);

      const stems = container.querySelectorAll('.botanical-stem, [data-part="stem"]');
      const leaves = container.querySelectorAll('.botanical-leaf, [data-part="leaf"]');
      const veins = container.querySelectorAll('.botanical-vein, [data-part="vein"]');

      expect(stems.length).toBeGreaterThanOrEqual(2);
      expect(leaves.length).toBeGreaterThanOrEqual(10);
      expect(veins.length).toBeGreaterThanOrEqual(10);
    });

    it('employs olive and sage color tones with layered opacities for visual depth', () => {
      const { container } = render(<BotanicalFrame />);
      const htmlContent = container.innerHTML;

      // Olive palette tones: #505B46 or #68745C or #3A4233
      const hasOlive = /#505B46|#68745C|#3A4233/i.test(htmlContent);
      // Sage palette tones: #A7B09A or #8F9A83 or #C2C9B8
      const hasSage = /#A7B09A|#8F9A83|#C2C9B8/i.test(htmlContent);

      expect(hasOlive).toBe(true);
      expect(hasSage).toBe(true);

      // Verifies layered opacities for foreground/background depth
      const layeredOpacityElements = container.querySelectorAll('[fill-opacity], [stroke-opacity], [opacity]');
      expect(layeredOpacityElements.length).toBeGreaterThanOrEqual(5);
    });

    it('features asymmetrical natural distribution between left and right canopies', () => {
      const { container } = render(<BotanicalFrame />);

      const leftCanopy = container.querySelector('.botanical-canopy-left, [data-canopy="left"]');
      const rightCanopy = container.querySelector('.botanical-canopy-right, [data-canopy="right"]');

      expect(leftCanopy).not.toBeNull();
      expect(rightCanopy).not.toBeNull();

      // Ensure right is not merely a cloned identical path set of left
      const leftHtml = leftCanopy?.innerHTML || '';
      const rightHtml = rightCanopy?.innerHTML || '';
      expect(leftHtml).not.toEqual(rightHtml);
    });

    it('supports isVisible prop for reveal choreography', () => {
      // Hidden state
      const { container: hiddenContainer } = render(<BotanicalFrame isVisible={false} />);
      const hiddenRoot = hiddenContainer.firstElementChild as HTMLElement;

      const hiddenStyle = hiddenRoot.getAttribute('style') || '';
      const isHiddenOpacity =
        hiddenRoot.classList.contains('opacity-0') ||
        hiddenStyle.includes('opacity: 0') ||
        hiddenStyle.includes('opacity:0');
      expect(isHiddenOpacity).toBe(true);

      // Revealed state (default)
      const { container: visibleContainer } = render(<BotanicalFrame isVisible={true} />);
      const visibleRoot = visibleContainer.firstElementChild as HTMLElement;

      const visibleStyle = visibleRoot.getAttribute('style') || '';
      const isVisibleOpacity =
        visibleRoot.classList.contains('opacity-100') ||
        visibleStyle.includes('opacity: 1') ||
        visibleStyle.includes('opacity:1') ||
        !visibleStyle.includes('opacity: 0');
      expect(isVisibleOpacity).toBe(true);
    });

    it('bypasses transforms and motion transitions when reduced motion is requested', () => {
      // Set reduced motion media query match
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

      const { container } = render(<BotanicalFrame isVisible={false} />);
      const root = container.firstElementChild as HTMLElement;
      const style = root.getAttribute('style') || '';

      // In reduced motion mode, downward translation (-20px) is bypassed
      expect(style).not.toMatch(/translate(?:Y|3d)?\([^)]*-\d+px/i);
      // Duration is instantaneous (0s or 0ms or transition: none)
      if (style.includes('transition')) {
        expect(style).toMatch(/transition(?:-duration)?:\s*(?:0s|0ms|none)/i);
      }
    });
  });

  describe('PaperTexture Component', () => {
    it('renders with aria-hidden="true" on root and SVG elements', () => {
      const { container } = render(<PaperTexture />);
      const root = container.firstElementChild as HTMLElement;

      expect(root).toHaveAttribute('aria-hidden', 'true');

      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThanOrEqual(1);
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('has pointer-events: none and full-bleed inset-0 styling', () => {
      const { container } = render(<PaperTexture />);
      const root = container.firstElementChild as HTMLElement;

      expect(
        root.classList.contains('pointer-events-none') ||
        root.style.pointerEvents === 'none'
      ).toBe(true);

      expect(
        root.classList.contains('inset-0') ||
        (root.style.top === '0px' && root.style.left === '0px')
      ).toBe(true);
    });

    it('renders static SVG noise/grain filter without runtime GPU-heavy animated elements', () => {
      const { container } = render(<PaperTexture />);

      // Has static SVG filter or turbulence noise
      const turbulence = container.querySelector('feTurbulence');
      expect(turbulence).toBeInTheDocument();

      // Must be static: NO animated elements (no <animate>, <animateTransform>, etc.)
      const animatedElements = container.querySelectorAll('animate, animateTransform');
      expect(animatedElements).toHaveLength(0);
    });
  });
});
