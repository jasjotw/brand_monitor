const API_BASE_URL = process.env.NEXT_PUBLIC_AGXP_URL || 'http://localhost:8787';

// Test JWT for development (expires in 1 year)
// User: { userId: 1, email: 'test@example.com' }
// This token is explicitly signed with the word 'Secret' to match the backend config.
const MOCK_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImV4cCI6MTgwMzQ2Nzg0OH0.ISUA2dhD1Ao2MbKXAoVMdtJOKkuAMZIUnXit7Hcw0Rs'; 

// Helper to get the auth token
function getAuthToken() {
  // Try to get a real token from localStorage if we're in the browser
  if (typeof window !== 'undefined') {
    const storedToken = localStorage.getItem('agxp_auth_token');
    if (storedToken) return storedToken;
  }
  
  // Fallback to MOCK_JWT for development or if no token is found
  return MOCK_JWT;
}

export async function connectCloudflare(token: string) {
  const res = await fetch(`${API_BASE_URL}/api/cloudflare/connect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({ token }),
  });
  
  const data = await res.json();
  if (!res.ok) {
    return { success: false, error: data.error || `HTTP error ${res.status}` };
  }
  return data;
}

export async function getZones() {
  const res = await fetch(`${API_BASE_URL}/api/cloudflare/zones`, {
    headers: { 'Authorization': `Bearer ${getAuthToken()}` }
  });
  
  const data = await res.json();
  if (!res.ok) {
     throw new Error(data.error || `HTTP error ${res.status}`);
  }
  return data;
}

export async function createDeployment(zoneId: string, zoneName: string, siteId: string) {
  const res = await fetch(`${API_BASE_URL}/api/deployments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({ zoneId, zoneName, siteId }),
  });
  return res.json();
}

export async function getDeployments() {
  const res = await fetch(`${API_BASE_URL}/api/deployments`, {
    headers: { 'Authorization': `Bearer ${getAuthToken()}` }
  });
  return res.json();
}

export async function deleteDeployment(deploymentId: number) {
  const res = await fetch(`${API_BASE_URL}/api/deployments/${deploymentId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${getAuthToken()}` }
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `HTTP error ${res.status}`);
  }
  return data;
}

export async function createVariant(deploymentId: number, urlPath: string, content: string) {
  const res = await fetch(`${API_BASE_URL}/api/variants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({ deploymentId, urlPath, content }),
  });
  return res.json();
}

export interface AutoGenerateVariantResponse {
  success: boolean;
  variantId?: number;
  contentPreview?: string;
  error?: string;
}

export async function autoGenerateVariant(
  deploymentId: number,
  urlPath: string,
  sourceUrl: string,
  instructions?: string
): Promise<AutoGenerateVariantResponse> {
  const res = await fetch(`${API_BASE_URL}/api/variants/auto-generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({ deploymentId, urlPath, sourceUrl, instructions }),
  });
  return res.json();
}

export async function getAnalytics(deploymentId: number) {
  const res = await fetch(`${API_BASE_URL}/api/analytics/${deploymentId}`, {
    headers: { 'Authorization': `Bearer ${getAuthToken()}` }
  });
  return res.json();
}

export async function getSummary(deploymentId: number, period: '24h' | '7d' = '24h') {
  const res = await fetch(`${API_BASE_URL}/api/analytics/${deploymentId}/summary?period=${period}`, {
    headers: { 'Authorization': `Bearer ${getAuthToken()}` }
  });
  return res.json();
}
