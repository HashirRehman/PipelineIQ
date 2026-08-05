// Thin client-side helper for calling this app's API routes (the API-first
// replacement for Server Actions). Keeps error handling consistent: every
// route returns { error } on failure, so a non-ok response throws an Error
// with the server's message — callers can catch and surface it.
export async function apiRequest<T>(
  path: string,
  method: "POST" | "PATCH",
  body: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Request failed (${res.status})`);
  }
  return json as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, "POST", body);
}
