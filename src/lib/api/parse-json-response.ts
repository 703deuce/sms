/** Parse a fetch Response as JSON with a readable error when the body is not JSON. */
export async function parseJsonResponse<T = Record<string, unknown>>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.ok
        ? "Empty response from server"
        : `Request failed (${res.status} ${res.statusText || "error"})`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      res.ok
        ? "Server returned an invalid response"
        : `Request failed (${res.status}): server returned a non-JSON response`,
    );
  }
}
