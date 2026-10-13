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
    it('renders with aria-hidden="true" on root and img elements for accessibility hygiene', () => {
      const { container } = render(<Chandelier />);
      const root = container.firstElementChild as HTMLElement;

      expect(root).toHaveAttribute('aria-hidden', 'true');

      const img = container.querySelector('img');
      expect(img).not.toBeNull();
      expect(img).toHaveAttribute('aria-hidden', 'true');
    });

    it('has pointer-events: none to prevent intercepting user interactions', () => {
      const { container } = render(<Chandelier />);
      const root = container.firstElementChild as HTMLElement;

      expect(
        root.classList.contains('pointer-events-none') ||
        root.style.pointerEvents === 'none'
      ).toBe(true);
    });

    it('renders chandelier artwork with responsive image styling and asset path', () => {
      const { container } = render(<Chandelier />);
      const img = container.querySelector('img');

      expect(img).not.toBeNull();
      expect(img?.getAttribute('src')).toBeTruthy();
      expect(img?.getAttribute('src')).toContain('chandelier');
      expect(img?.classList.contains('pointer-events-none')).toBe(true);
      expect(img?.classList.contains('object-contain')).toBe(true);
    });

    it('applies chandelier-sway class under standard motion and removes it when reduced motion is preferred', () => {
      const { container: normalContainer } = render(<Chandelier />);
      const normalImg = normalContainer.querySelector('img');
      expect(normalImg?.classList.contains('chandelier-sway')).toBe(true);

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

      const { container: reducedContainer } = render(<Chandelier />);
      const reducedImg = reducedContainer.querySelector('img');
      expect(reducedImg?.classList.contains('chandelier-sway')).toBe(false);
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
