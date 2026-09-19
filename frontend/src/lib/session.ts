/**
 * RetailIQ Nepal - Session and Cookie Management Utility
 * Provides client-side cookie storage, inactivity tracking, and auto-logout timers.
 */

export const SESSION_COOKIE_NAME = "retailiq_session";
export const DEFAULT_IDLE_TIMEOUT_MINUTES = 30; // 30 minutes of inactivity

/**
 * Set a browser cookie with Secure, SameSite=Lax, and Max-Age
 */
export function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;
  const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";
  const secureFlag = isSecure ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secureFlag}`;
}

/**
 * Get cookie value by name
 */
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^|;\\s*)(${name})=([^;]*)`));
  return match ? decodeURIComponent(match[3]) : null;
}

/**
 * Remove a cookie by setting its expiration to the past
 */
export function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

/**
 * Starts a new merchant user session with cookies, localStorage, and timestamp.
 */
export function startSession(
  token: string,
  user: any,
  idleTimeoutMinutes: number = DEFAULT_IDLE_TIMEOUT_MINUTES
): void {
  if (typeof window === "undefined") return;

  const maxAgeSeconds = idleTimeoutMinutes * 60;
  // Set session cookie
  setCookie(SESSION_COOKIE_NAME, token, maxAgeSeconds);

  // Store in localStorage
  localStorage.setItem("retailiq_token", token);
  localStorage.setItem("retailiq_user", JSON.stringify(user));
  localStorage.setItem("retailiq_last_active", String(Date.now()));
  localStorage.setItem("retailiq_idle_limit_ms", String(idleTimeoutMinutes * 60 * 1000));

  window.dispatchEvent(new Event("retailiq_user_updated"));
  window.dispatchEvent(new Event("retailiq_session_started"));
}

/**
 * Refreshes user session activity on interaction (extends cookie and resets idle timer).
 */
export function refreshSessionActivity(): void {
  if (typeof window === "undefined") return;
  const token = localStorage.getItem("retailiq_token");
  if (!token) return;

  const limitMs = Number(localStorage.getItem("retailiq_idle_limit_ms")) || DEFAULT_IDLE_TIMEOUT_MINUTES * 60 * 1000;
  localStorage.setItem("retailiq_last_active", String(Date.now()));

  // Refresh cookie life
  setCookie(SESSION_COOKIE_NAME, token, Math.floor(limitMs / 1000));
}

/**
 * Validates if the current session is still active and within idle limits.
 */
export function checkSessionValidity(): {
  isValid: boolean;
  remainingSeconds: number;
} {
  if (typeof window === "undefined") {
    return { isValid: false, remainingSeconds: 0 };
  }

  const token = localStorage.getItem("retailiq_token");
  const user = localStorage.getItem("retailiq_user");
  const lastActive = Number(localStorage.getItem("retailiq_last_active") || 0);
  const idleLimitMs = Number(localStorage.getItem("retailiq_idle_limit_ms")) || DEFAULT_IDLE_TIMEOUT_MINUTES * 60 * 1000;

  if (!token || !user || !lastActive) {
    return { isValid: false, remainingSeconds: 0 };
  }

  const elapsedMs = Date.now() - lastActive;
  const remainingMs = idleLimitMs - elapsedMs;

  if (remainingMs <= 0) {
    // Idle timeout reached
    return { isValid: false, remainingSeconds: 0 };
  }

  return {
    isValid: true,
    remainingSeconds: Math.floor(remainingMs / 1000),
  };
}

/**
 * Clears session cookies, local storage credentials, and dispatches logout event.
 */
export function terminateSession(reason: "manual" | "timeout" = "manual"): void {
  if (typeof window === "undefined") return;

  deleteCookie(SESSION_COOKIE_NAME);
  localStorage.removeItem("retailiq_token");
  localStorage.removeItem("retailiq_user");
  localStorage.removeItem("retailiq_last_active");
  localStorage.removeItem("retailiq_idle_limit_ms");

  if (reason === "timeout") {
    sessionStorage.setItem("retailiq_logout_reason", "inactivity");
  } else {
    sessionStorage.removeItem("retailiq_logout_reason");
  }

  window.dispatchEvent(new CustomEvent("retailiq_session_ended", { detail: { reason } }));
  window.dispatchEvent(new Event("retailiq_user_updated"));
}
