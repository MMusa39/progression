/**
 * HTTP client for the Progression API.
 *
 * - Attaches a valid access token to every request (refreshing it if needed).
 * - On 401, refreshes once and retries; if that also fails the session has
 *   been revoked, so the user is signed out.
 * - Converts error responses (RFC 9457 problem details) and network failures
 *   into `ApiError`, so the UI handles one error type.
 */
import { env } from '@/config/env';
import { authSession } from '@/features/auth/session';

import type { ProblemDetail } from './types';

export class ApiError extends Error {
  constructor(
    /** HTTP status, or 0 when the request never reached the server. */
    readonly status: number,
    message: string,
    readonly problem?: ProblemDetail,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetworkError() {
    return this.status === 0;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
};

async function send(path: string, token: string, { method = 'GET', body, signal }: RequestOptions) {
  try {
    return await fetch(`${env.apiUrl}${path}`, {
      method,
      signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, await authSession.getAccessToken(), options);

  if (response.status === 401) {
    response = await send(path, await authSession.getAccessToken({ forceRefresh: true }), options);
    if (response.status === 401) {
      await authSession.expire();
      throw new ApiError(401, 'Your session has expired. Please sign in again.');
    }
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    const problem = json as ProblemDetail | undefined;
    throw new ApiError(response.status, problem?.detail ?? problem?.title ?? `Request failed (${response.status})`, problem);
  }
  return json as T;
}
