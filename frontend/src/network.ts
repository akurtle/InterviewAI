const DEFAULT_API_BASE = "http://127.0.0.1:8000";
const DEFAULT_WS_BASE = "ws://127.0.0.1:8000";

export const getApiBase = () => import.meta.env.VITE_API_BASE ?? DEFAULT_API_BASE;
export const getWsBase = () => import.meta.env.VITE_WS_BASE ?? DEFAULT_WS_BASE;

const getAlternateLoopbackUrl = (rawUrl: string): string | null => {
  try {
    const url = new URL(rawUrl);
    if (url.hostname === "localhost") {
      url.hostname = "127.0.0.1";
      return url.toString();
    }

    if (url.hostname === "127.0.0.1") {
      url.hostname = "localhost";
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
};

export async function fetchWithLoopbackFallback(
  input: string,
  init?: RequestInit
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (!(error instanceof TypeError)) {
      throw error;
    }

    const alternateUrl = getAlternateLoopbackUrl(input);
    if (!alternateUrl || alternateUrl === input) {
      throw error;
    }

    return fetch(alternateUrl, init);
  }
}
