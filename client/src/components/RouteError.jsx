import React from 'react';
import ErrorPage, { errorToPreset } from './ErrorPage';

/**
 * Consistent error view for a failed data load.
 * `error` is the caught (axios) error; `onRetry` re-runs the load.
 * The preset follows error.response?.status: 5xx -> server page, 401/403 -> permission,
 * 404 -> not found, no response -> offline/network. Raw API text is never shown.
 * Retry is offered only where retrying can help (not for 401/403/404).
 */
export default function RouteError({ error, onRetry, compact = true }) {
  const { key, code } = errorToPreset(error);
  const retryable = key !== 404 && key !== 403;
  const primaryAction = onRetry && retryable ? { label: 'נסו שוב', onClick: onRetry } : undefined;
  return <ErrorPage code={code} compact={compact} runtime primaryAction={primaryAction} />;
}
