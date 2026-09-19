/**
 * API Fetch wrapper for client requests.
 * Owner: Moksh [M]
 */

const BASE_URL = import.meta.env?.VITE_API_URL || '';

export async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.detail || json.error || `HTTP ${res.status}`);
    }
    return json.data !== undefined ? json.data : json;
  } catch (err) {
    console.error(`[API Error] ${path}:`, err.message);
    throw err;
  }
}

export const api = {
  get: (path, options) => apiFetch(path, { method: 'GET', ...options }),
  post: (path, body, options) =>
    apiFetch(path, {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    }),
};
