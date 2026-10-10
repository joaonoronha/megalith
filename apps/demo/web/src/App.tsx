import { useState, useEffect, useCallback } from 'react';

export interface ApiMessage {
  message: string;
  service: string;
}

export function App() {
  const [data, setData] = useState<ApiMessage | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/message');
      if (!response.ok) {
        throw new Error(`API returned HTTP status ${response.status}`);
      }
      const json: ApiMessage = await response.json();
      setData(json);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown network error';
      setError(`Failed to connect to backend: ${errorMessage}`);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessage();
  }, [fetchMessage]);

  return (
    <main style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '640px', margin: '40px auto', padding: '0 20px', lineHeight: 1.5 }}>
      <header>
        <h1 data-testid="product-title" style={{ fontSize: '1.75rem', marginBottom: '8px' }}>
          Megalith Demo
        </h1>
        <p data-testid="product-description" style={{ color: '#4b5563', margin: '0 0 20px 0' }}>
          A polyglot demonstration application verifying independent frontend and backend service communication in the Megalith monorepo.
        </p>
      </header>

      <section
        style={{
          padding: '20px',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          backgroundColor: '#fafafa',
        }}
      >
        {loading && (
          <p data-testid="loading-state" style={{ color: '#6b7280', margin: 0 }}>
            Loading message from backend...
          </p>
        )}

        {!loading && error && (
          <div data-testid="error-state">
            <p style={{ color: '#dc2626', margin: '0 0 12px 0' }}>
              <strong>Error:</strong> {error}
            </p>
            <button
              type="button"
              onClick={fetchMessage}
              data-testid="retry-button"
              style={{
                padding: '8px 16px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && data && (
          <div data-testid="success-state">
            <p style={{ margin: '0 0 8px 0' }}>
              <strong>Backend Message:</strong> {data.message}
            </p>
            <p style={{ margin: '0 0 16px 0', color: '#4b5563', fontSize: '0.875rem' }}>
              Service Origin: <code>{data.service}</code>
            </p>
            <button
              type="button"
              onClick={fetchMessage}
              data-testid="refresh-button"
              style={{
                padding: '6px 12px',
                backgroundColor: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Refresh
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
