import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { I18nProvider } from '../src/i18n';
import { InvitationHero } from '../src/components/InvitationHero';
import { AnimatedInvitationText } from '../src/components/AnimatedInvitationText';

describe('InvitationHero & AnimatedInvitationText Components', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'pt-PT';

    originalMatchMedia = window.matchMedia;
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

  const renderHero = (initialLocale: 'pt-PT' | 'en' | 'fr' = 'pt-PT') => {
    return render(
      <I18nProvider initialLocale={initialLocale}>
        <InvitationHero />
      </I18nProvider>
    );
  };

  describe('Editorial Typography Rendering', () => {
    it('renders all required wedding invitation copy in Portuguese by default', () => {
      renderHero('pt-PT');

      // Eyebrow
      expect(screen.getByText('O NOSSO CASAMENTO')).toBeInTheDocument();

      // Couple names
      expect(screen.getByText('Madalena & João')).toBeInTheDocument();

      // Date and time
      expect(screen.getByText(/16 de agosto de 2027/i)).toBeInTheDocument();
      expect(screen.getByText(/16h00/i)).toBeInTheDocument();

      // Venue
      expect(screen.getByText('Quinta da Grilla')).toBeInTheDocument();

      // Invitation message
      expect(
        screen.getByText(
          'É com muita alegria que vos convidamos a celebrar connosco o nosso casamento.'
        )
      ).toBeInTheDocument();
    });

    it('renders the gold divider line with center diamond motif', () => {
      const { container } = renderHero();

      const divider = container.querySelector('.hero-divider, [data-testid="hero-divider"]');
      expect(divider).toBeInTheDocument();

      const diamond = container.querySelector('.hero-divider-diamond, [data-motif="diamond"]');
      expect(diamond).toBeInTheDocument();
    });

    it('uses romantic editorial serif font and responsive clamp styling for couple names', () => {
      const { container } = renderHero();

      const namesElement = screen.getByText('Madalena & João');
      expect(namesElement).toBeInTheDocument();
      expect(namesElement.tagName).toBe('H1');

      // Verify names element or class has styling for responsive sizing
      expect(
        namesElement.classList.contains('hero-names') ||
        namesElement.getAttribute('style')?.includes('clamp')
      ).toBe(true);
    });
  });

  describe('Layering & Composition Hierarchy', () => {
    it('renders the complete layered visual stack in proper hierarchy', () => {
      const { container } = renderHero();

      // Layer 1: Background + Paper Texture
      const paperTexture = container.querySelector('.paper-texture');
      expect(paperTexture).toBeInTheDocument();
      expect(paperTexture).toHaveAttribute('aria-hidden', 'true');

      // Layer 2: Botanical Canopy
      const botanicalFrame = container.querySelector('.botanical-frame');
      expect(botanicalFrame).toBeInTheDocument();
      expect(botanicalFrame).toHaveAttribute('aria-hidden', 'true');

      // Layer 3: Chandelier
      const chandelier = container.querySelector('.chandelier-container');
      expect(chandelier).toBeInTheDocument();
      expect(chandelier).toHaveAttribute('aria-hidden', 'true');

      // Layer 4: Language Switcher
      const languageSwitcher = container.querySelector('.language-switcher');
      expect(languageSwitcher).toBeInTheDocument();

      // Layer 5: Animated Invitation Text
      const invitationText = container.querySelector('.invitation-text-container');
      expect(invitationText).toBeInTheDocument();

      // Layer 6: Reception Table Illustration
      const reception = container.querySelector('.reception-illustration');
      expect(reception).toBeInTheDocument();
      expect(reception).toHaveAttribute('aria-hidden', 'true');
    });

    it('ensures illustrations have non-blocking pointer events', () => {
      const { container } = renderHero();

      const illustrations = container.querySelectorAll(
        '.paper-texture, .botanical-frame, .chandelier-container, .reception-illustration'
      );
      illustrations.forEach((el) => {
        const hasPointerNone =
          el.classList.contains('pointer-events-none') ||
          (el as HTMLElement).style.pointerEvents === 'none';
        expect(hasPointerNone).toBe(true);
      });
    });
  });

  describe('Dynamic Language Switching', () => {
    it('dynamically updates invitation copy when switching to English', () => {
      renderHero('pt-PT');

      // Initial Portuguese
      expect(screen.getByText('O NOSSO CASAMENTO')).toBeInTheDocument();
      expect(screen.getByText(/16 de agosto de 2027/i)).toBeInTheDocument();

      // Switch to English
      const enBtn = screen.getByText('EN');
      fireEvent.click(enBtn);

      // Verify English copy
      expect(screen.getByText('OUR WEDDING')).toBeInTheDocument();
      expect(screen.getByText(/16 August 2027/i)).toBeInTheDocument();
      expect(screen.getByText(/4:00 PM/i)).toBeInTheDocument();
      expect(
        screen.getByText('We are delighted to invite you to celebrate our wedding with us.')
      ).toBeInTheDocument();
      expect(screen.getByText('Quinta da Grilla')).toBeInTheDocument();
    });

    it('dynamically updates invitation copy when switching to French', () => {
      renderHero('pt-PT');

      // Switch to French
      const frBtn = screen.getByText('FR');
      fireEvent.click(frBtn);

      // Verify French copy
      expect(screen.getByText('NOTRE MARIAGE')).toBeInTheDocument();
      expect(screen.getByText(/16 août 2027/i)).toBeInTheDocument();
      expect(screen.getByText(/16h00/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          "C'est avec une immense joie que nous vous invitons à célébrer notre mariage à nos côtés."
        )
      ).toBeInTheDocument();
    });
  });

  describe('prefers-reduced-motion Handling', () => {
    it('suppresses animation delays and transform offsets when reduced motion is preferred', () => {
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

      const { container } = renderHero();

      // Check text container or hero root has reduced-motion indicator or zero animation delay
      const heroRoot = container.firstElementChild as HTMLElement;
      expect(heroRoot).toBeInTheDocument();

      const textContainer = container.querySelector('.invitation-text-container') as HTMLElement;
      expect(textContainer).toBeInTheDocument();

      // Animated elements should not have transform translateY translations when reduced motion is active
      const textStyle = textContainer.getAttribute('style') || '';
      expect(textStyle).not.toMatch(/translate(?:Y|3d)?\([^)]*-\d+px/i);
    });
  });

  describe('Responsive Layout & Overflow Safety', () => {
    it('has full viewport height container with overflow-hidden and safe-area insets', () => {
      const { container } = renderHero();
      const hero = container.firstElementChild as HTMLElement;

      expect(hero.classList.contains('invitation-hero')).toBe(true);
      // Hero container should prevent horizontal overflow
      expect(
        hero.classList.contains('overflow-hidden') ||
        window.getComputedStyle(hero).overflowX === 'hidden'
      ).toBe(true);
    });

    it('renders AnimatedInvitationText as standalone component with responsive container', () => {
      const { container } = render(
        <I18nProvider initialLocale="pt-PT">
          <AnimatedInvitationText />
        </I18nProvider>
      );

      const textContainer = container.querySelector('.invitation-text-container');
      expect(textContainer).toBeInTheDocument();
      expect(screen.getByText('Madalena & João')).toBeInTheDocument();
    });
  });
});
