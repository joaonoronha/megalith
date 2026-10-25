import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  queryPostHogHogQL,
  getEnvironmentCredentials,
  fetchLiveTelemetry,
} from '../src/services/posthogApi';

describe('posthogApi service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts credentials from environment if provided', () => {
    const creds = getEnvironmentCredentials();
    // In vitest environment with .env.local, project ID and key should be present
    if (creds) {
      expect(creds.projectId).toBeTruthy();
      expect(creds.personalApiKey).toBeTruthy();
      expect(creds.host).toBeTruthy();
    }
  });

  it('fetches and maps live telemetry events cleanly', async () => {
    const mockResponse = {
      results: [
        [
          'uuid-1',
          'wedding_calendar_saved',
          '{"$geoip_city_name":"Lisbon","$geoip_country_name":"Portugal","$geoip_country_code":"PT"}',
          'wedding',
          '2026-10-25T19:00:00Z',
        ],
        [
          'uuid-2',
          'portfolio_project_clicked',
          '{"$geoip_city_name":"Lisbon","$geoip_country_name":"Portugal","$geoip_country_code":"PT"}',
          'portfolio',
          '2026-10-25T19:05:00Z',
        ],
      ],
      columns: ['uuid', 'event', 'properties', 'app', 'timestamp'],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as unknown as Response);

    const res = await fetchLiveTelemetry({
      host: 'https://eu.i.posthog.com',
      projectId: '999',
      personalApiKey: 'phx_test',
    });

    expect(res.events).toHaveLength(2);
    expect(res.events?.[0].name).toBe('wedding_calendar_saved');
    expect(res.events?.[0].app).toBe('wedding');
    expect(res.events?.[1].name).toBe('portfolio_project_clicked');
  });

  it('successfully queries PostHog HogQL API and returns results', async () => {
    const mockResponse = {
      results: [['wedding', 1024], ['portfolio', 342]],
      columns: ['app', 'count'],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as unknown as Response);

    const data = await queryPostHogHogQL(
      {
        host: 'https://eu.i.posthog.com',
        projectId: '12345',
        personalApiKey: 'phx_test_key',
      },
      'SELECT properties.app, count() FROM events GROUP BY properties.app'
    );

    expect(data.results).toEqual([['wedding', 1024], ['portfolio', 342]]);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://eu.i.posthog.com/api/projects/12345/query/',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer phx_test_key',
        },
      })
    );
  });

  it('throws descriptive error on API failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as unknown as Response);

    await expect(
      queryPostHogHogQL(
        {
          host: 'https://eu.i.posthog.com',
          projectId: '12345',
          personalApiKey: 'invalid',
        },
        'SELECT 1'
      )
    ).rejects.toThrow('PostHog API request failed (401): Unauthorized');
  });
});
