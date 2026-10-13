import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { VenueSection } from '../src/components/VenueSection';
import { I18nProvider } from '../src/i18n';
import { WEDDING_CONFIG } from '../src/config/wedding';

describe('VenueSection Component', () => {
  it('renders venue heading, Quinta da Grilla, country, address, and translated links in Portuguese by default', () => {
    render(
      <I18nProvider initialLocale="pt-PT">
        <VenueSection />
      </I18nProvider>
    );

    expect(screen.getByText('O local')).toBeInTheDocument();
    expect(screen.getByText('Quinta da Grilla')).toBeInTheDocument();
    expect(screen.getByText(/Estrada da Grilla/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Portugal/i).length).toBeGreaterThanOrEqual(1);

    // Venue Website link
    const websiteLink = screen.getByRole('link', { name: /website da Quinta da Grilla/i });
    expect(websiteLink).toHaveTextContent('Ver o local');
    expect(websiteLink).toHaveAttribute('href', WEDDING_CONFIG.venueWebsite);
    expect(websiteLink).toHaveAttribute('target', '_blank');
    expect(websiteLink).toHaveAttribute('rel', 'noopener noreferrer');

    // Directions link
    const directionsLink = screen.getByRole('link', { name: /direções para a Quinta da Grilla/i });
    expect(directionsLink).toHaveTextContent('Como chegar');
    expect(directionsLink).toHaveAttribute('href', WEDDING_CONFIG.venueMapsUrl);
    expect(directionsLink).toHaveAttribute('target', '_blank');
    expect(directionsLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders arched map iframe pointing to Quinta da Grilla coordinates with correct locale language', () => {
    const { rerender } = render(
      <I18nProvider initialLocale="pt-PT">
        <VenueSection />
      </I18nProvider>
    );

    const mapIframePt = screen.getByTitle('Mapa da localização da Quinta da Grilla');
    expect(mapIframePt).toBeInTheDocument();
    expect(mapIframePt).toHaveAttribute(
      'src',
      expect.stringContaining(`q=${WEDDING_CONFIG.venueCoordinates.lat},${WEDDING_CONFIG.venueCoordinates.lng}`)
    );
    expect(mapIframePt).toHaveAttribute('src', expect.stringContaining('hl=pt'));
    expect(mapIframePt).toHaveAttribute('src', expect.stringContaining('output=embed'));

    // English locale
    rerender(
      <I18nProvider initialLocale="en">
        <VenueSection />
      </I18nProvider>
    );

    const mapIframeEn = screen.getByTitle('Location map of Quinta da Grilla');
    expect(mapIframeEn).toBeInTheDocument();
    expect(mapIframeEn).toHaveAttribute('src', expect.stringContaining('hl=en'));
  });

  it('renders translated venue heading and button text for English and French locales', () => {
    const { rerender } = render(
      <I18nProvider initialLocale="en">
        <VenueSection />
      </I18nProvider>
    );

    expect(screen.getByText('The venue')).toBeInTheDocument();
    expect(screen.getByText('View the venue')).toBeInTheDocument();
    expect(screen.getByText('Get directions')).toBeInTheDocument();

    rerender(
      <I18nProvider initialLocale="fr">
        <VenueSection />
      </I18nProvider>
    );

    expect(screen.getByText('Le lieu')).toBeInTheDocument();
    expect(screen.getByText('Découvrir le lieu')).toBeInTheDocument();
    expect(screen.getByText('Itinéraire')).toBeInTheDocument();
  });

  it('provides accessible external link labels warning for new tab opening', () => {
    render(
      <I18nProvider initialLocale="pt-PT">
        <VenueSection />
      </I18nProvider>
    );

    const websiteLink = screen.getByRole('link', { name: /website da Quinta da Grilla/i });
    expect(websiteLink).toHaveAttribute(
      'aria-label',
      'Abrir website da Quinta da Grilla numa nova janela'
    );

    const directionsLink = screen.getByRole('link', { name: /direções para a Quinta da Grilla/i });
    expect(directionsLink).toHaveAttribute(
      'aria-label',
      'Abrir direções para a Quinta da Grilla no Google Maps'
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
