import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';

describe('App Component', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders product title, description, and initial loading state', () => {
    // Unresolved promise to keep loading state active
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));

    render(<App />);

    expect(screen.getByTestId('product-title')).toHaveTextContent('Megalith Demo');
    expect(screen.getByTestId('product-description')).toBeInTheDocument();
    expect(screen.getByTestId('loading-state')).toHaveTextContent('Loading message from backend...');
  });

  it('renders successful API response when fetch resolves', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: 'Hello from Megalith API',
        service: 'demo/api',
      }),
    } as Response);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('success-state')).toBeInTheDocument();
    });

    expect(screen.getByText('Hello from Megalith API')).toBeInTheDocument();
    expect(screen.getByText('demo/api')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    expect(screen.queryByTestId('error-state')).not.toBeInTheDocument();
  });

  it('renders error message and retry button when fetch fails', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Connection refused'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });

    expect(screen.getByText(/Failed to connect to backend: Connection refused/i)).toBeInTheDocument();
    expect(screen.getByTestId('retry-button')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
  });

  it('re-fetches and recovers upon clicking retry button', async () => {
    // First attempt fails
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Backend offline'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });

    // Second attempt succeeds
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: 'Hello from Megalith API',
        service: 'demo/api',
      }),
    } as Response);

    fireEvent.click(screen.getByTestId('retry-button'));

    await waitFor(() => {
      expect(screen.getByTestId('success-state')).toBeInTheDocument();
    });

    expect(screen.getByText('Hello from Megalith API')).toBeInTheDocument();
    expect(screen.queryByTestId('error-state')).not.toBeInTheDocument();
  });
});
