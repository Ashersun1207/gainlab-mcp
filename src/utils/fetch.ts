import { ProxyAgent } from "undici";

const PROXY_URL = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || "http://127.0.0.1:7897";

const NO_PROXY_HOSTS = ["127.0.0.1", "localhost", "volcengineapi.com", "dashscope.aliyuncs.com"];

let proxyAgent: ProxyAgent | null = null;

function getProxyAgent(): ProxyAgent {
  if (!proxyAgent) {
    proxyAgent = new ProxyAgent(PROXY_URL);
  }
  return proxyAgent;
}

/**
 * Fetch with automatic proxy support.
 * Uses Node 18+ global fetch (undici under the hood) + ProxyAgent dispatcher.
 * Skips proxy for local and China services.
 */
export async function proxyFetch(url: string, options?: RequestInit): Promise<Response> {
  const urlObj = new URL(url);
  const needsProxy = !NO_PROXY_HOSTS.some(h => urlObj.hostname.includes(h));

  if (needsProxy) {
    try {
      // Node 18+ global fetch accepts undici dispatcher
      return await fetch(url, {
        ...options,
        // @ts-expect-error -- Node 18+ fetch accepts dispatcher from undici
        dispatcher: getProxyAgent(),
      });
    } catch {
      // Fallback to direct fetch if proxy fails
      return await fetch(url, options);
    }
  }

  return await fetch(url, options);
}
