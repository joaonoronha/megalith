import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryPostHogHogQL } from '../src/services/posthogApi';

describe('posthogApi service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
