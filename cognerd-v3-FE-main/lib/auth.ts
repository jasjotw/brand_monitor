const AUTH_TOKEN_KEY = "cognerd_auth_token";
let refreshTimer: number | null = null;
let isRedirectingToLogin = false;

function decodeBase64Url(value: string): string {
  if (typeof window === "undefined") return "";
  let base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  try {
    return window.atob(base64);
  } catch {
    return "";
  }
}

function parseJwt(token: string) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = decodeBase64Url(parts[1]);
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function getTokenExpiration(token: string): number | null {
  const payload = parseJwt(token);
  if (!payload || typeof payload.exp !== "number") return null;
  return payload.exp;
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  scheduleTokenRefresh(token);
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  scheduleTokenRefresh(null);
}

function redirectToLogin(): void {
  if (typeof window === "undefined" || isRedirectingToLogin) return;
  isRedirectingToLogin = true;
  window.location.href = "/login";
}

function handleSessionExpired(): null {
  clearAuthToken();
  redirectToLogin();
  return null;
}

export function scheduleTokenRefresh(token: string | null): void {
  if (typeof window === "undefined") return;
  if (refreshTimer) {
    window.clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  if (!token) return;
  const exp = getTokenExpiration(token);
  if (!exp) {
    handleSessionExpired();
    return;
  }
  const now = Math.floor(Date.now() / 1000);
  if (exp <= now) {
    handleSessionExpired();
    return;
  }
  const delay = Math.max((exp - now - 60) * 1000, 5000);
  refreshTimer = window.setTimeout(() => {
    refreshAuthToken();
  }, delay);
}

export async function refreshAuthToken(): Promise<string | null> {
  const token = getAuthToken();
  if (!token || typeof window === "undefined") return null;
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_BRAND_MONITOR_URL || "http://localhost:4001";
    const response = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.token) {
      if (response.status === 401) {
        return handleSessionExpired();
      }
      return null;
    }
    setAuthToken(data.token);
    return data.token;
  } catch {
    return null;
  }
}
