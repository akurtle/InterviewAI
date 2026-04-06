const DEFAULT_API_BASE = "http://127.0.0.1:8000";

export const getApiBase = () => import.meta.env.VITE_API_BASE ?? DEFAULT_API_BASE;

export const getWsBase = () =>
  import.meta.env.VITE_WS_BASE ?? getApiBase().replace(/^http/, "ws");

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

const openWebSocket = (url: string): Promise<WebSocket> =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let settled = false;

    const cleanup = () => {
      ws.removeEventListener("open", handleOpen);
      ws.removeEventListener("error", handleFailure);
      ws.removeEventListener("close", handleFailure);
    };

    const handleOpen = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(ws);
    };

    const handleFailure = () => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        ws.close();
      } catch {}
      reject(new Error(`WebSocket failed to open: ${url}`));
    };

    ws.addEventListener("open", handleOpen);
    ws.addEventListener("error", handleFailure);
    ws.addEventListener("close", handleFailure);
  });

export async function openWebSocketWithLoopbackFallback(
  url: string
): Promise<WebSocket> {
  try {
    return await openWebSocket(url);
  } catch (error) {
    const alternateUrl = getAlternateLoopbackUrl(url);
    if (!alternateUrl || alternateUrl === url) {
      throw error;
    }

    return openWebSocket(alternateUrl);
  }
}
