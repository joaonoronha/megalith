import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { VenueSection } from '../src/components/VenueSection';
import { I18nProvider } from '../src/i18n';
import { WEDDING_CONFIG } from '../src/config/wedding';

describe('VenueSection Component', () => {
  it('renders venue heading, Quinta da Grilla, country, and translated link in Portuguese by default', () => {
    render(
      <I18nProvider initialLocale="pt-PT">
        <VenueSection />
      </I18nProvider>
    );

    expect(screen.getByText('O local')).toBeInTheDocument();
    expect(screen.getByText('Quinta da Grilla')).toBeInTheDocument();
    expect(screen.getByText(/Portugal/i)).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /Quinta da Grilla/i });
    expect(link).toHaveTextContent('Ver o local');
    expect(link).toHaveAttribute('href', WEDDING_CONFIG.venueWebsite);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders translated venue heading and link text for English and French locales', () => {
    const { rerender } = render(
      <I18nProvider initialLocale="en">
        <VenueSection />
      </I18nProvider>
    );

    expect(screen.getByText('The venue')).toBeInTheDocument();
    expect(screen.getByText('View the venue')).toBeInTheDocument();

    rerender(
      <I18nProvider initialLocale="fr">
        <VenueSection />
      </I18nProvider>
    );

    expect(screen.getByText('Le lieu')).toBeInTheDocument();
    expect(screen.getByText('Découvrir le lieu')).toBeInTheDocument();
  });

  it('provides accessible external link label warning for new tab opening', () => {
    render(
      <I18nProvider initialLocale="pt-PT">
        <VenueSection />
      </I18nProvider>
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute(
      'aria-label',
      'Abrir website da Quinta da Grilla numa nova janela'
    );
  });

  it('renders decorative botanical or diamond motifs with aria-hidden="true"', () => {
    const { container } = render(
      <I18nProvider initialLocale="pt-PT">
        <VenueSection />
      </I18nProvider>
    );

    const motifs = container.querySelectorAll('[aria-hidden="true"]');
    expect(motifs.length).toBeGreaterThan(0);
  });

  it('supports custom className prop and renders semantic section', () => {
    const { container } = render(
      <I18nProvider initialLocale="pt-PT">
        <VenueSection className="custom-venue-class" />
      </I18nProvider>
    );

    const section = container.querySelector('section');
    expect(section).toBeInTheDocument();
    expect(section).toHaveClass('venue-section');
    expect(section).toHaveClass('custom-venue-class');
  });
});
