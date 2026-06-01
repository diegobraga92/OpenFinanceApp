const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export interface HealthResponse {
  status: string;
  database: string;
  rabbitmq: string;
  version: string;
}

export interface HealthError {
  status: string;
  database: string;
  rabbitmq: string;
  details: string;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    const error: HealthError = await response.json();
    throw new Error(`Health check failed: ${error.details}`);
  }
  return response.json();
}