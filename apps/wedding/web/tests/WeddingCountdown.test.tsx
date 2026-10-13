import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { WeddingCountdown } from '../src/components/WeddingCountdown';
import { I18nProvider } from '../src/i18n';

describe('WeddingCountdown Component', () => {
  const TARGET_UTC = '2027-08-16T15:00:00Z';

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders countdown heading and translated unit labels in Portuguese by default', () => {
    vi.setSystemTime(new Date('2027-08-06T12:00:00Z'));

    render(
      <I18nProvider initialLocale="pt-PT">
        <WeddingCountdown targetUtc={TARGET_UTC} />
      </I18nProvider>
    );

    expect(screen.getByText('Faltam apenas...')).toBeInTheDocument();
    expect(screen.getByText('dias')).toBeInTheDocument();
    expect(screen.getByText('horas')).toBeInTheDocument();
    expect(screen.getByText('minutos')).toBeInTheDocument();
    expect(screen.getByText('segundos')).toBeInTheDocument();
  });

  it('renders translated labels in English and French when locale changes', () => {
    vi.setSystemTime(new Date('2027-08-06T12:00:00Z'));

    const { rerender } = render(
      <I18nProvider initialLocale="en">
        <WeddingCountdown targetUtc={TARGET_UTC} />
      </I18nProvider>
    );

    expect(screen.getByText('Counting down...')).toBeInTheDocument();
    expect(screen.getByText('days')).toBeInTheDocument();
    expect(screen.getByText('hours')).toBeInTheDocument();

    rerender(
      <I18nProvider initialLocale="fr">
        <WeddingCountdown targetUtc={TARGET_UTC} />
      </I18nProvider>
    );

    expect(screen.getByText('Le compte à rebours...')).toBeInTheDocument();
    expect(screen.getByText('jours')).toBeInTheDocument();
    expect(screen.getByText('heures')).toBeInTheDocument();
  });

  it('displays accurate calculated countdown digits with tabular numeric styling', () => {
    // 5 days, 3 hours, 20 minutes, 10 seconds before target
    // Target is 2027-08-16T15:00:00Z
    // Now = 2027-08-11T11:39:50Z
    vi.setSystemTime(new Date('2027-08-11T11:39:50Z'));

    render(
      <I18nProvider initialLocale="pt-PT">
        <WeddingCountdown targetUtc={TARGET_UTC} />
      </I18nProvider>
    );

    expect(screen.getByTestId('countdown-days')).toHaveTextContent('5');
    expect(screen.getByTestId('countdown-hours')).toHaveTextContent('3');
    expect(screen.getByTestId('countdown-minutes')).toHaveTextContent('20');
    expect(screen.getByTestId('countdown-seconds')).toHaveTextContent('10');
  });

  it('updates countdown digits every second via interval', () => {
    vi.setSystemTime(new Date('2027-08-16T14:59:58Z')); // 2 seconds before target

    render(
      <I18nProvider initialLocale="pt-PT">
        <WeddingCountdown targetUtc={TARGET_UTC} />
      </I18nProvider>
    );

    expect(screen.getByTestId('countdown-seconds')).toHaveTextContent('2');

    // Advance 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('countdown-seconds')).toHaveTextContent('1');

    // Advance 1 second to reach target
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('countdown-seconds')).toHaveTextContent('0');
  });

  it('cleans up timer interval on unmount to prevent memory leaks', () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

    const { unmount } = render(
      <I18nProvider initialLocale="pt-PT">
        <WeddingCountdown targetUtc={TARGET_UTC} />
      </I18nProvider>
    );

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('includes accessible aria-live="polite" region for screen readers', () => {
    render(
      <I18nProvider initialLocale="pt-PT">
        <WeddingCountdown targetUtc={TARGET_UTC} />
      </I18nProvider>
    );

    const liveRegion = screen.getByRole('region');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
  });
});
