import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../src/App';

describe('Dashboard App Component', () => {
  it('renders header, title, and initial empty overview with "-" before live data is received', () => {
    render(<App />);

    expect(screen.getByText('Megalith Telemetry Hub')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-visitors')).toHaveTextContent('-');
    expect(screen.getByTestId('kpi-pageviews')).toHaveTextContent('-');
    expect(screen.getByTestId('kpi-actions')).toHaveTextContent('-');
    expect(screen.getByTestId('kpi-eng-rate')).toHaveTextContent('-');
    expect(screen.getByTestId('events-table')).toBeInTheDocument();
    expect(screen.getByText('No telemetry events received yet (-)')).toBeInTheDocument();
  });

  it('switches tabs and displays "-" when no data has been received yet for that app', () => {
    render(<App />);

    const weddingTab = screen.getByTestId('tab-wedding');
    fireEvent.click(weddingTab);

    // Wedding metrics show '-' before live data is loaded
    expect(screen.getByTestId('kpi-visitors')).toHaveTextContent('-');
    expect(screen.getByTestId('kpi-pageviews')).toHaveTextContent('-');
    expect(screen.getByTestId('kpi-actions')).toHaveTextContent('-');
    expect(screen.getByText('Save the Date Funnel')).toBeInTheDocument();
  });

  it('switches to Portfolio tab and displays "-" before live data is received', () => {
    render(<App />);

    const portfolioTab = screen.getByTestId('tab-portfolio');
    fireEvent.click(portfolioTab);

    expect(screen.getByTestId('kpi-visitors')).toHaveTextContent('-');
    expect(screen.getByTestId('kpi-pageviews')).toHaveTextContent('-');
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
