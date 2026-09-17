import { HealthStatus, InventoryItem, ConnectionState } from "@/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  (typeof window !== "undefined" && !window.location.hostname.includes("localhost")
    ? "https://retailiq-nepal-api.onrender.com"
    : "http://localhost:8000");

/**
 * Robust fetch helper with timeout support.
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * Health check probe with Render cold-start awareness.
 * When Render free-tier is sleeping, the first probe might fail or take up to 45s.
 */
export async function probeBackendHealth(
  onProgress?: (state: ConnectionState, elapsedSeconds: number) => void
): Promise<HealthStatus> {
  const maxAttempts = 10;
  const pollIntervalMs = 4000;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    if (attempt > 1) {
      onProgress?.("waking_up", elapsed);
    } else {
      onProgress?.("checking", elapsed);
    }

    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/health`, { cache: "no-store" }, 6000);
      if (res.ok) {
        const data: HealthStatus = await res.json();
        onProgress?.("connected", elapsed);
        return data;
      }
    } catch {
      // Failed probe: Likely cold start spinning up or local backend not started yet
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  onProgress?.("failed", Math.round((Date.now() - startTime) / 1000));
  throw new Error("Unable to reach backend after multiple attempts.");
}

/**
 * Fetch sample or tenant inventory items from FastAPI.
 */
export async function fetchInventoryItems(businessId?: string): Promise<InventoryItem[]> {
  const url = businessId
    ? `${API_BASE_URL}/api/v1/items?business_id=${encodeURIComponent(businessId)}`
    : `${API_BASE_URL}/api/v1/items`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch inventory: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Helper to extract human-readable error string from backend response.
 * Handles FastAPI validation error arrays (HTTP 422) and standard detail objects without converting to [object Object].
 */
export function formatApiError(errData: any, fallback: string): string {
  if (!errData) return fallback;
  if (typeof errData === "string") return errData;
  if (typeof errData.detail === "string") return errData.detail;

  if (Array.isArray(errData.detail)) {
    return errData.detail
      .map((item: any) => {
        if (typeof item === "string") return item;
        const fieldName = Array.isArray(item.loc)
          ? item.loc.filter((part: any) => part !== "body").join(" ")
          : "";
        const rawMsg = item.msg || "त्रुटि भयो";
        return fieldName ? `${fieldName}: ${rawMsg}` : rawMsg;
      })
      .join("; ");
  }

  if (errData.detail && typeof errData.detail === "object") {
    return errData.detail.msg || errData.detail.message || JSON.stringify(errData.detail);
  }

  if (typeof errData.message === "string") return errData.message;
  return fallback;
}

/**
 * Upload POS CSV file to backend ETL pipeline.
 */
export async function uploadPosCsv(file: File, businessId: string): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("business_id", businessId);

  const res = await fetch(`${API_BASE_URL}/api/v1/etl/pos-upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "CSV upload failed" }));
    throw new Error(formatApiError(errorData, `Upload failed with status ${res.status}`));
  }

  return res.json();
}

/**
 * Login merchant user to receive JWT token.
 */
export async function loginUser(email: string, password: string, businessId?: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password, business_id: businessId || undefined }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(formatApiError(err, "इमेल वा पासवर्ड मिलेन (Invalid login credentials)"));
  }

  return res.json();
}

/**
 * Register new merchant tenant and owner.
 */
export async function registerMerchant(data: {
  business_name: string;
  pan_vat_number?: string;
  full_name: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      business_name: data.business_name.trim(),
      pan_vat_number: data.pan_vat_number?.trim() || undefined,
      full_name: data.full_name.trim(),
      email: data.email.trim().toLowerCase(),
      password: data.password,
      phone: data.phone?.trim() || undefined,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Registration failed" }));
    throw new Error(formatApiError(err, "नयाँ पसल दर्ता प्रक्रिया असफल भयो।"));
  }

  return res.json();
}

/**
 * Fetch available SaaS subscription tiers and features.
 */
export async function fetchSubscriptionPlans(): Promise<any[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/subscription/plans`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to fetch subscription plans");
  }
  return res.json();
}

/**
 * Fetch current subscription status for a merchant business.
 */
export async function fetchCurrentSubscription(businessId: string = "00000000-0000-0000-0000-000000000001"): Promise<any> {
  const targetId = businessId || "00000000-0000-0000-0000-000000000001";
  const res = await fetch(
    `${API_BASE_URL}/api/v1/subscription/current?business_id=${encodeURIComponent(targetId)}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    return {
      tier: "pro",
      plan_name: "Pro Merchant",
      plan_name_nepali: "प्रो मर्चन्ट",
      can_upload_excel: true,
      can_use_ml_forecast: true,
      can_generate_pdf: true,
      unlimited_ai_chat: true,
    };
  }
  return res.json();
}

/**
 * Upgrade or change merchant subscription plan.
 */
export async function upgradeSubscriptionPlan(
  businessId: string,
  targetTier: string,
  paymentChannel: string = "fonepay",
  transactionRef?: string,
  billingCycle: string = "monthly",
  amountPaid?: number
): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/v1/subscription/upgrade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      business_id: businessId,
      target_tier: targetTier,
      payment_channel: paymentChannel,
      transaction_ref: transactionRef || undefined,
      billing_cycle: billingCycle,
      amount_paid_npr: amountPaid || undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upgrade failed" }));
    throw new Error(formatApiError(err, "सब्सक्रिप्सन अपग्रेड असफल भयो।"));
  }
  return res.json();
}


/**
 * Chat with Bajar ko Sathi AI assistant.
 */
export async function askBajarSathi(
  businessId: string,
  query: string,
  businessName?: string,
  storeContext?: any
): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/v1/bajar-ko-sathi/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      business_id: businessId,
      query: query.trim(),
      business_name: businessName || undefined,
      store_context: storeContext || undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Chat request failed" }));
    throw new Error(formatApiError(err, "उत्तर प्राप्त हुन सकेन।"));
  }
  return res.json();
}

export { API_BASE_URL };
