import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { App } from '../src/App';

describe('App Root, Gate State & Natural Progression', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'pt-PT';
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Gated Pre-Launch Experience', () => {
    it('renders SaveTheDateGate when app is gated by default', () => {
      const { container } = render(<App initialLocale="pt-PT" />);

      // Save the Date components are present
      expect(container.querySelector('.save-the-date-gate-root')).toBeInTheDocument();
      expect(screen.getAllByText(/save the date/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByTestId('save-the-date-video')).toBeInTheDocument();
      expect(screen.getByTestId('gate-countdown-days')).toBeInTheDocument();

      // Full invitation sections are not yet rendered
      expect(container.querySelector('.invitation-hero')).not.toBeInTheDocument();
      expect(container.querySelector('.wedding-schedule-section')).not.toBeInTheDocument();
      expect(container.querySelector('.venue-section')).not.toBeInTheDocument();
    });

    it('allows forced gated view via ?preview=gated search param', () => {
      const { container } = render(
        <App
          initialLocale="pt-PT"
          unlockUtc="2020-01-01T00:00:00Z"
          searchOverride="?preview=gated"
        />
      );

      expect(container.querySelector('.save-the-date-gate-root')).toBeInTheDocument();
      expect(container.querySelector('.invitation-hero')).not.toBeInTheDocument();
    });
  });

  describe('Unlocked Full Wedding Invitation Experience', () => {
    it('renders all sections in natural document order when unlocked via ?preview=unlocked', () => {
      const { container } = render(
        <App initialLocale="pt-PT" searchOverride="?preview=unlocked" />
      );

      const hero = container.querySelector('.invitation-hero');
      const countdown = container.querySelector('.wedding-countdown-section');
      const schedule = container.querySelector('.wedding-schedule-section');
      const venue = container.querySelector('.venue-section');
      const footer = container.querySelector('.wedding-footer');

      expect(hero).toBeInTheDocument();
      expect(countdown).toBeInTheDocument();
      expect(schedule).toBeInTheDocument();
      expect(venue).toBeInTheDocument();
      expect(footer).toBeInTheDocument();

      // Verify DOM order: hero before countdown before schedule before venue before footer
      expect(
        hero!.compareDocumentPosition(countdown!) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(
        countdown!.compareDocumentPosition(schedule!) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(
        schedule!.compareDocumentPosition(venue!) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(
        venue!.compareDocumentPosition(footer!) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it('preserves natural uninhibited page scrolling without scroll-locking or body trapping', () => {
      const { container } = render(
        <App initialLocale="pt-PT" searchOverride="?preview=unlocked" />
      );

      const root = container.querySelector('.wedding-app-root') as HTMLElement;
      expect(root).toBeInTheDocument();

      // Root should not trap scroll with fixed positioning or hidden overflow
      const rootStyle = window.getComputedStyle(root);
      expect(rootStyle.position).not.toBe('fixed');
      expect(rootStyle.overflow).not.toBe('hidden');
      expect(rootStyle.overflowY).not.toBe('hidden');
    });

    it('synchronizes document lang and propagates locale changes across all sections', () => {
      render(<App initialLocale="pt-PT" searchOverride="?preview=unlocked" />);

      expect(document.documentElement.lang).toBe('pt-PT');

      // Hero Portuguese copy
      expect(screen.getByText('O NOSSO CASAMENTO')).toBeInTheDocument();
      // Countdown Portuguese copy
      expect(screen.getByText('Faltam apenas...')).toBeInTheDocument();
      // Schedule Portuguese copy
      expect(screen.getByText('O NOSSO DIA')).toBeInTheDocument();
      // Venue Portuguese copy
      expect(screen.getByText('O local')).toBeInTheDocument();

      // Switch to English
      const enButton = screen.getByRole('button', { name: /English/i });
      fireEvent.click(enButton);

      expect(document.documentElement.lang).toBe('en');
      // Hero English copy
      expect(screen.getByText('OUR WEDDING')).toBeInTheDocument();
      // Countdown English copy
      expect(screen.getByText('Counting down...')).toBeInTheDocument();
      // Schedule English copy
      expect(screen.getByText('WEDDING DAY')).toBeInTheDocument();
      // Venue English copy
      expect(screen.getByText('The venue')).toBeInTheDocument();
    });

    it('renders elegant footer with diamond motif and couple names', () => {
      render(<App initialLocale="pt-PT" searchOverride="?preview=unlocked" />);

      const footer = screen.getByRole('contentinfo');
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveTextContent(/Madalena & João/i);
      expect(footer).toHaveTextContent(/2027/i);
    });
  });
});
