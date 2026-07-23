import type { components } from './api-types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export type HealthResponse = components['schemas']['HealthResponse'];
export type HealthError = components['schemas']['HealthError'];

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    const error: HealthError = await response.json();
    throw new Error(`Health check failed: ${error.details}`);
  }
  return response.json();
}