import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { App } from '../src/App';

describe('App Root & Natural Scroll Progression', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'pt-PT';
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders all sections in natural document order: Hero -> Countdown -> Venue -> Footer', () => {
    const { container } = render(<App initialLocale="pt-PT" />);

    const hero = container.querySelector('.invitation-hero');
    const countdown = container.querySelector('.wedding-countdown-section');
    const venue = container.querySelector('.venue-section');
    const footer = container.querySelector('.wedding-footer');

    expect(hero).toBeInTheDocument();
    expect(countdown).toBeInTheDocument();
    expect(venue).toBeInTheDocument();
    expect(footer).toBeInTheDocument();

    // Verify DOM order: hero before countdown before venue before footer
    expect(
      hero!.compareDocumentPosition(countdown!) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      countdown!.compareDocumentPosition(venue!) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      venue!.compareDocumentPosition(footer!) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('preserves natural uninhibited page scrolling without scroll-locking or body trapping', () => {
    const { container } = render(<App initialLocale="pt-PT" />);

    const root = container.querySelector('.wedding-app-root') as HTMLElement;
    expect(root).toBeInTheDocument();

    // Root should not trap scroll with fixed positioning or hidden overflow
    const rootStyle = window.getComputedStyle(root);
    expect(rootStyle.position).not.toBe('fixed');
    expect(rootStyle.overflow).not.toBe('hidden');
    expect(rootStyle.overflowY).not.toBe('hidden');
  });

  it('synchronizes document lang and propagates locale changes across all sections', () => {
    render(<App initialLocale="pt-PT" />);

    expect(document.documentElement.lang).toBe('pt-PT');

    // Hero Portuguese copy
    expect(screen.getByText('O NOSSO CASAMENTO')).toBeInTheDocument();
    // Countdown Portuguese copy
    expect(screen.getByText('Faltam apenas...')).toBeInTheDocument();
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
    // Venue English copy
    expect(screen.getByText('The venue')).toBeInTheDocument();
  });

  it('renders elegant footer with diamond motif and couple names', () => {
    render(<App initialLocale="pt-PT" />);

    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveTextContent(/Madalena & João/i);
    expect(footer).toHaveTextContent(/2027/i);
  });
});
