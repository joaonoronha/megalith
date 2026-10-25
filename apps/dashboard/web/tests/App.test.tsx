import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../src/App';

describe('Dashboard App Component', () => {
  it('renders header, title, and initial KPI overview', () => {
    render(<App />);

    expect(screen.getByText('Megalith Telemetry Hub')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-visitors')).toHaveTextContent('1,428');
    expect(screen.getByTestId('kpi-pageviews')).toHaveTextContent('3,892');
    expect(screen.getByTestId('events-table')).toBeInTheDocument();
  });

  it('switches metrics and funnel when selecting Wedding tab', () => {
    render(<App />);

    const weddingTab = screen.getByTestId('tab-wedding');
    fireEvent.click(weddingTab);

    // Wedding metrics should update
    expect(screen.getByTestId('kpi-visitors')).toHaveTextContent('1,024');
    expect(screen.getByTestId('kpi-pageviews')).toHaveTextContent('2,840');
    expect(screen.getByText('Save the Date Funnel')).toBeInTheDocument();
  });

  it('switches metrics when selecting Portfolio tab', () => {
    render(<App />);

    const portfolioTab = screen.getByTestId('tab-portfolio');
    fireEvent.click(portfolioTab);

    expect(screen.getByTestId('kpi-visitors')).toHaveTextContent('342');
    expect(screen.getByText('Portfolio Engagement Funnel')).toBeInTheDocument();
  });

  it('opens and closes PostHog settings modal', () => {
    render(<App />);

    const settingsBtn = screen.getByTestId('posthog-settings-btn');
    fireEvent.click(settingsBtn);

    expect(screen.getByText('PostHog API Configuration')).toBeInTheDocument();

    const closeBtn = screen.getByLabelText('Close modal');
    fireEvent.click(closeBtn);

    expect(screen.queryByText('PostHog API Configuration')).not.toBeInTheDocument();
  });
});
