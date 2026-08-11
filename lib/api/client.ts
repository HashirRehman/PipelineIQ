// Organization id for the current session, set by the OrganizationProvider
// in the dashboard shell. Every API request (via apiRequest or withOrgId)
// forwards it so routes can verify the caller belongs to the org they're
// scoping to.
let currentOrganizationId: string | null = null;

export function setOrganizationId(id: string | null): void {
  currentOrganizationId = id;
}

export function getOrganizationId(): string | null {
  return currentOrganizationId;
}

/** Appends ?organizationId= to a GET url so org-scoped fetches carry it. */
export function withOrgId(url: string, organizationId?: string | null): string {
  const id = organizationId ?? currentOrganizationId;
  if (!id) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}organizationId=${encodeURIComponent(id)}`;
}

/** Carries the HTTP status so callers can tell a 404 from a network blip. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** queryFn behind every useQuery. Throws ApiError so 4xx isn't retried. */
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(withOrgId(path), { signal });

  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, json.error ?? `Request failed (${res.status})`);
  }

  return (await res.json()) as T;
}

export async function apiRequest<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const headers: Record<string, string> = isFormData
    ? {}
    : { "Content-Type": "application/json" };
  if (currentOrganizationId) {
    headers["x-organization-id"] = currentOrganizationId;
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Request failed (${res.status})`);
  }
  return json as T;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, "POST", body);
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, "PATCH", body);
}

export async function apiDelete<T>(path: string): Promise<T> {
  return apiRequest<T>(path, "DELETE");
}
