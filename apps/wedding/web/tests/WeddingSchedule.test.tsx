import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { WeddingSchedule } from '../src/components/WeddingSchedule';
import { I18nProvider } from '../src/i18n';

describe('WeddingSchedule Component', () => {
  it('renders schedule eyebrow, title, and all 6 timeline events in Portuguese by default', () => {
    render(
      <I18nProvider initialLocale="pt-PT">
        <WeddingSchedule />
      </I18nProvider>
    );

    expect(screen.getByText('O NOSSO DIA')).toBeInTheDocument();
    expect(screen.getByText('16 DE AGOSTO, 2027')).toBeInTheDocument();

    const expectedEvents = [
      { time: '15:30', title: 'Chegada dos Convidados' },
      { time: '16:00', title: 'Cerimónia' },
      { time: '17:00', title: 'Fotos de Grupo & Brinde' },
      { time: '17:30', title: 'Cocktail & Aperitivos' },
      { time: '19:30', title: 'Jantar & Celebração' },
      { time: '22:00', title: 'Corte do Bolo & Festa' },
    ];

    for (const evt of expectedEvents) {
      expect(screen.getByText(evt.time)).toBeInTheDocument();
      expect(screen.getByText(evt.title)).toBeInTheDocument();
    }

    expect(
      screen.getByText(/Receção calorosa aos convidados/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A celebração do nosso casamento com a troca de votos/i)
    ).toBeInTheDocument();
  });

  it('renders translated schedule copy when switched to English and French', () => {
    const { rerender } = render(
      <I18nProvider initialLocale="en">
        <WeddingSchedule />
      </I18nProvider>
    );

    expect(screen.getByText('WEDDING DAY')).toBeInTheDocument();
    expect(screen.getByText('16 AUGUST 2027')).toBeInTheDocument();
    expect(
      screen.getByText('Guest Arrival & Welcome Drinks')
    ).toBeInTheDocument();
    expect(screen.getByText('Ceremony')).toBeInTheDocument();
    expect(screen.getByText('Cocktail Hour')).toBeInTheDocument();
    expect(screen.getByText('Cake Cutting & Party')).toBeInTheDocument();

    rerender(
      <I18nProvider initialLocale="fr">
        <WeddingSchedule />
      </I18nProvider>
    );

    expect(screen.getByText('JOUR DU MARIAGE')).toBeInTheDocument();
    expect(screen.getByText('16 AOÛT 2027')).toBeInTheDocument();
    expect(
      screen.getByText('Arrivée des Invités & Rafraîchissements')
    ).toBeInTheDocument();
    expect(screen.getByText('Cérémonie')).toBeInTheDocument();
    expect(screen.getByText('Cocktail & Apéritif')).toBeInTheDocument();
    expect(screen.getByText('Pièce Montée & Soirée')).toBeInTheDocument();
  });

  it('uses accessible list semantics for schedule items', () => {
    render(
      <I18nProvider initialLocale="pt-PT">
        <WeddingSchedule />
      </I18nProvider>
    );

    const list = screen.getByRole('list');
    expect(list).toBeInTheDocument();

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(6);
  });

  it('sets aria-hidden="true" on decorative SVG elements and dividers', () => {
    const { container } = render(
      <I18nProvider initialLocale="pt-PT">
        <WeddingSchedule />
      </I18nProvider>
    );

    const hiddenElements = container.querySelectorAll('[aria-hidden="true"]');
    expect(hiddenElements.length).toBeGreaterThan(0);
  });

  it('supports custom className prop and renders semantic section', () => {
    const { container } = render(
      <I18nProvider initialLocale="pt-PT">
        <WeddingSchedule className="custom-schedule-class" />
      </I18nProvider>
    );

    const section = container.querySelector('section');
    expect(section).toBeInTheDocument();
    expect(section).toHaveClass('wedding-schedule-section');
    expect(section).toHaveClass('custom-schedule-class');
  });
});
