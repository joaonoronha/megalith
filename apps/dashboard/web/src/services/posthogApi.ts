export interface PostHogQueryCredentials {
  host: string;
  projectId: string;
  personalApiKey: string;
}

export interface PostHogQueryResult {
  results: unknown[][];
  columns: string[];
}

/**
 * Queries the PostHog HogQL API for live analytics data.
 */
export async function queryPostHogHogQL(
  creds: PostHogQueryCredentials,
  query: string
): Promise<PostHogQueryResult> {
  const host = creds.host.replace(/\/$/, '');
  const url = `${host}/api/projects/${creds.projectId}/query/`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${creds.personalApiKey}`,
    },
    body: JSON.stringify({
      query: {
        kind: 'HogQLQuery',
        query,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PostHog API request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    results: data.results || [],
    columns: data.columns || [],
  };
}
