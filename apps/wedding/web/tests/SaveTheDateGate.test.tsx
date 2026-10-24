import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { I18nProvider } from '../src/i18n';
import { SaveTheDateGate } from '../src/components/SaveTheDateGate';

describe('SaveTheDateGate component', () => {
  beforeEach(() => {
    // Mock HTMLMediaElement play and pause
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = vi.fn();
    // Mock requestFullscreen
    window.HTMLMediaElement.prototype.requestFullscreen = vi.fn().mockResolvedValue(undefined);
  });

  it('renders couple display name, badge, and date teaser without flowers/botanical canopy', () => {
    const { container } = render(
      <I18nProvider initialLocale="pt-PT">
        <SaveTheDateGate />
      </I18nProvider>
    );

    expect(screen.getByText('Madalena & João')).toBeInTheDocument();
    expect(screen.getAllByText(/Save the Date/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/16 · 08 · 2027/)).toBeInTheDocument();

    // Botanical frame is excluded from the Save the Date screen
    expect(container.querySelector('.botanical-frame')).not.toBeInTheDocument();

    // Organic video frame is rendered around the video
    expect(container.querySelector('.video-frame')).toBeInTheDocument();
    expect(container.querySelector('.screenshot-quinta-container')).toBeInTheDocument();
  });

  it('preloads video with preload="auto" and requests fullscreen on play', async () => {
    render(
      <I18nProvider initialLocale="en">
        <SaveTheDateGate videoUrl="/assets/save-the-date.MOV" />
      </I18nProvider>
    );

    const video = screen.getByTestId('save-the-date-video') as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video.getAttribute('src')).toBe('/assets/save-the-date.MOV');
    expect(video.getAttribute('preload')).toBe('auto');

    const playButton = screen.getByTestId('video-play-button');
    expect(playButton).toBeInTheDocument();

    // Clicking play triggers requestFullscreen and video.play()
    await act(async () => {
      fireEvent.click(playButton);
    });
    expect(window.HTMLMediaElement.prototype.requestFullscreen).toHaveBeenCalled();
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it('renders countdown digits with accessible labels', () => {
    render(
      <I18nProvider initialLocale="en">
        <SaveTheDateGate unlockUtc="2027-02-16T00:00:00Z" />
      </I18nProvider>
    );

    expect(screen.getByTestId('gate-countdown-days')).toBeInTheDocument();
    expect(screen.getByTestId('gate-countdown-hours')).toBeInTheDocument();
    expect(screen.getByTestId('gate-countdown-minutes')).toBeInTheDocument();
    expect(screen.getByTestId('gate-countdown-seconds')).toBeInTheDocument();
    expect(screen.getByText('OUR STORY CONTINUES IN...')).toBeInTheDocument();
  });

  it('updates text translations when language is switched', () => {
    render(
      <I18nProvider initialLocale="fr">
        <SaveTheDateGate />
      </I18nProvider>
    );

    expect(screen.getByText('NOTRE HISTOIRE CONTINUE DANS...')).toBeInTheDocument();
    expect(screen.getByText(/16 · 08 · 2027/)).toBeInTheDocument();
  });

  it('renders loading splash screen by default with translating names and pulsing button', () => {
    render(
      <I18nProvider initialLocale="pt-PT">
        <SaveTheDateGate />
      </I18nProvider>
    );

    // Intro overlay is present by default
    const introNames = screen.getByTestId('intro-names');
    expect(introNames).toBeInTheDocument();
    expect(screen.getByTestId('intro-name-madalena')).toHaveTextContent('Madalena');
    expect(screen.getByTestId('intro-name-joao')).toHaveTextContent('João');

    const introButton = screen.getByTestId('intro-save-the-date-button');
    expect(introButton).toBeInTheDocument();
    expect(document.querySelector('.intro-black-backdrop')).toBeInTheDocument();

    // Body and HTML scrolling are locked while overlay is displayed
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.style.touchAction).toBe('none');
  });

  it('does not lock body scrolling when intro overlay is not shown', () => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.body.style.touchAction = '';

    render(
      <I18nProvider initialLocale="pt-PT">
        <SaveTheDateGate initialShowIntro={false} />
      </I18nProvider>
    );

    expect(document.body.style.overflow).not.toBe('hidden');
    expect(document.documentElement.style.overflow).not.toBe('hidden');
  });

  it('renders intro overlay with sliding names, triggers suck-in zoom on click, then enters fullscreen and fades in video audio', async () => {
    vi.useFakeTimers();
    // Mock scrollIntoView
    window.HTMLElement.prototype.scrollIntoView = vi.fn();

    render(
      <I18nProvider initialLocale="pt-PT">
        <SaveTheDateGate initialShowIntro={true} />
      </I18nProvider>
    );

    // Intro overlay names are rendered
    const introNames = screen.getByTestId('intro-names');
    expect(introNames).toBeInTheDocument();
    expect(screen.getByTestId('intro-name-madalena')).toBeInTheDocument();
    expect(screen.getByTestId('intro-name-joao')).toBeInTheDocument();

    const introButton = screen.getByTestId('intro-save-the-date-button');
    expect(introButton).toBeInTheDocument();

    // Clicking the pulsing button initiates zooming state
    await act(async () => {
      fireEvent.click(introButton);
    });

    const overlay = document.querySelector('.save-the-date-intro-overlay');
    expect(overlay).toHaveClass('zooming');

    // Before animation finishes, fullscreen has not been requested yet
    expect(window.HTMLMediaElement.prototype.requestFullscreen).not.toHaveBeenCalled();

    // Advance 550ms timer for the high-velocity zoom animation and black backdrop to complete
    await act(async () => {
      vi.advanceTimersByTime(550);
    });

    expect(window.HTMLMediaElement.prototype.requestFullscreen).toHaveBeenCalled();
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();

    const video = screen.getByTestId('save-the-date-video') as HTMLVideoElement;
    expect(video).toHaveClass('fading-in');

    // Advance audio volume ramp timers (1800ms)
    await act(async () => {
      vi.advanceTimersByTime(1800);
    });
    expect(video.volume).toBe(1);

    vi.useRealTimers();
  });

  it('exits fullscreen without scrolling when video ends', async () => {
    vi.useFakeTimers();
    window.document.exitFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, 'fullscreenElement', {
      value: document.createElement('video'),
      configurable: true,
    });
    window.HTMLElement.prototype.scrollIntoView = vi.fn();

    render(
      <I18nProvider initialLocale="pt-PT">
        <SaveTheDateGate initialShowIntro={true} />
      </I18nProvider>
    );

    const video = screen.getByTestId('save-the-date-video') as HTMLVideoElement;
    (video as any).webkitExitFullscreen = vi.fn();

    // Trigger video ended
    await act(async () => {
      fireEvent.ended(video);
    });

    // Fullscreen exit must be triggered
    expect(window.document.exitFullscreen).toHaveBeenCalled();
    expect((video as any).webkitExitFullscreen).toHaveBeenCalled();

    // Advance timers
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    // Scrolling must NOT be triggered
    expect(window.HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
