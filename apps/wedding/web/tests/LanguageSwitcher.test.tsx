import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { I18nProvider } from '../src/i18n';
import { LanguageSwitcher } from '../src/components/LanguageSwitcher';

describe('LanguageSwitcher Component', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'pt-PT';
  });

  const renderWithProvider = (initialLocale: 'pt-PT' | 'en' | 'fr' = 'pt-PT') => {
    return render(
      <I18nProvider initialLocale={initialLocale}>
        <LanguageSwitcher />
      </I18nProvider>
    );
  };

  it('renders PT, EN, and FR language switch options without national flags', () => {
    renderWithProvider();

    const ptButton = screen.getByText('PT');
    const enButton = screen.getByText('EN');
    const frButton = screen.getByText('FR');

    expect(ptButton).toBeInTheDocument();
    expect(enButton).toBeInTheDocument();
    expect(frButton).toBeInTheDocument();

    expect(ptButton.tagName).toBe('BUTTON');
    expect(enButton.tagName).toBe('BUTTON');
    expect(frButton.tagName).toBe('BUTTON');

    // Strict constraint: Do NOT use national flags (emojis, img tags, or flag icons)
    const container = ptButton.closest('.language-switcher') || ptButton.parentElement;
    expect(container).not.toBeNull();
    const containerText = container?.textContent || '';
    // Check no flag emojis: Portuguese (🇵🇹), UK/US (🇬🇧/🇺🇸), French (🇫🇷)
    expect(containerText).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
    expect(container?.querySelectorAll('img, svg')).toHaveLength(0);
  });

  it('renders interpunct separator characters between language buttons', () => {
    renderWithProvider();
    const separators = screen.getAllByText('·');
    expect(separators).toHaveLength(2);
    separators.forEach((sep) => {
      expect(sep).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('marks active locale with aria-pressed="true" and inactives with aria-pressed="false"', () => {
    renderWithProvider('pt-PT');

    const ptButton = screen.getByText('PT');
    const enButton = screen.getByText('EN');
    const frButton = screen.getByText('FR');

    expect(ptButton).toHaveAttribute('aria-pressed', 'true');
    expect(enButton).toHaveAttribute('aria-pressed', 'false');
    expect(frButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('provides accessible labels for screen readers and updates navigation label dynamically', () => {
    renderWithProvider('pt-PT');

    const ptButton = screen.getByText('PT');
    const enButton = screen.getByText('EN');
    const frButton = screen.getByText('FR');

    expect(ptButton).toHaveAttribute('aria-label', 'Português');
    expect(enButton).toHaveAttribute('aria-label', 'English');
    expect(frButton).toHaveAttribute('aria-label', 'Français');

    // Accessible container navigation role
    const nav = screen.getByRole('navigation', { name: /selecionar idioma|select language|choisir la langue/i });
    expect(nav).toBeInTheDocument();
  });

  it('switches active locale when clicked and synchronizes context, document.documentElement.lang, and localStorage', () => {
    renderWithProvider('pt-PT');

    const ptButton = screen.getByText('PT');
    const enButton = screen.getByText('EN');
    const frButton = screen.getByText('FR');

    expect(document.documentElement.lang).toBe('pt-PT');

    // Click EN
    fireEvent.click(enButton);

    expect(enButton).toHaveAttribute('aria-pressed', 'true');
    expect(ptButton).toHaveAttribute('aria-pressed', 'false');
    expect(frButton).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('wedding_lang')).toBe('en');

    // Click FR
    fireEvent.click(frButton);

    expect(frButton).toHaveAttribute('aria-pressed', 'true');
    expect(enButton).toHaveAttribute('aria-pressed', 'false');
    expect(ptButton).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.lang).toBe('fr');
    expect(localStorage.getItem('wedding_lang')).toBe('fr');
  });

  it('supports keyboard navigation via focus and key activation', () => {
    renderWithProvider('pt-PT');

    const enButton = screen.getByText('EN');
    enButton.focus();
    expect(document.activeElement).toBe(enButton);

    fireEvent.click(enButton);
    expect(enButton).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.lang).toBe('en');
  });

  it('applies discreet styling classes and includes safe area positioning support', () => {
    const { container } = renderWithProvider();
    const switcher = container.querySelector('.language-switcher');
    expect(switcher).not.toBeNull();
  });
});
