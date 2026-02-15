import { ProxyAgent, fetch as undiciFetch } from "undici";

const PROXY_URL = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || "http://127.0.0.1:7897";

let proxyAgent: ProxyAgent | null = null;

function getProxyAgent(): ProxyAgent {
  if (!proxyAgent) {
    proxyAgent = new ProxyAgent(PROXY_URL);
  }
  return proxyAgent;
}

/**
 * Fetch with automatic proxy support.
 * Uses proxy for external APIs (Binance, etc.), skips for local/China APIs.
 */
export async function proxyFetch(url: string, options?: RequestInit): Promise<Response> {
  const urlObj = new URL(url);
  
  // Skip proxy for local and China services (volcano engine, alibaba cloud)
  const noProxyHosts = ["127.0.0.1", "localhost", "volcengineapi.com", "dashscope.aliyuncs.com"];
  const useProxy = !noProxyHosts.some(h => urlObj.hostname.includes(h));

  if (useProxy) {
    try {
      return await undiciFetch(url, {
        ...options as any,
        dispatcher: getProxyAgent(),
      }) as unknown as Response;
    } catch {
      // Fallback to direct fetch if proxy fails
      return await fetch(url, options);
    }
  }
  
  return await fetch(url, options);
}
