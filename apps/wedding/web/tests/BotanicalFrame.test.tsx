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
    it('renders with aria-hidden="true" on root and img elements for screen reader hygiene', () => {
      const { container } = render(<BotanicalFrame />);
      const root = container.firstElementChild as HTMLElement;

      expect(root).toHaveAttribute('aria-hidden', 'true');

      const img = container.querySelector('img');
      expect(img).not.toBeNull();
      expect(img).toHaveAttribute('aria-hidden', 'true');
    });

    it('has pointer-events: none to avoid intercepting user interactions', () => {
      const { container } = render(<BotanicalFrame />);
      const root = container.firstElementChild as HTMLElement;

      expect(
        root.classList.contains('pointer-events-none') ||
        root.style.pointerEvents === 'none'
      ).toBe(true);
    });

    it('renders floral canopy artwork broken into 5 swaying slices with responsive image styling', () => {
      const { container } = render(<BotanicalFrame />);
      const imgs = container.querySelectorAll('img');

      expect(imgs.length).toBe(5);
      imgs.forEach((img, idx) => {
        expect(img).toHaveAttribute('src');
        expect(img.getAttribute('src')).toContain(`flower-slice-${idx + 1}`);
        expect(img).toHaveAttribute('aria-hidden', 'true');
        expect(img.classList.contains('pointer-events-none')).toBe(true);
      });
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

    it('applies repeatable wedding-linen-seamless background image', () => {
      const { container } = render(<PaperTexture />);
      const root = container.firstElementChild as HTMLElement;
      expect(root.style.backgroundImage).toContain('wedding-linen-seamless');
      expect(root.style.backgroundRepeat).toBe('repeat');
    });
  });
});
