import WebSocket from "ws";
import { getClientConfig } from "./clientConfig.js";
import { createLogger } from "./logger.js";

const logger = createLogger("WebSocketClient");
const config = getClientConfig();

// Convert HTTP URL to WebSocket URL
function getWsUrl(): string {
  const baseUrl = config.dokployUrl;
  // Remove /api suffix if present and convert to wss
  const wsUrl = baseUrl
    .replace(/\/api\/?$/, "")
    .replace(/^https:/, "wss:")
    .replace(/^http:/, "ws:");
  return wsUrl;
}

interface WsLogOptions {
  endpoint: string;
  params: Record<string, string>;
  timeout?: number;
  maxLines?: number;
}

/**
 * Fetches logs via WebSocket connection
 * Collects data until timeout or connection closes
 */
export async function fetchLogsViaWebSocket(
  options: WsLogOptions
): Promise<string> {
  const { endpoint, params, timeout = 5000, maxLines = 1000 } = options;

  const wsBaseUrl = getWsUrl();
  const queryString = new URLSearchParams(params).toString();
  const fullUrl = `${wsBaseUrl}/${endpoint}?${queryString}`;

  logger.debug("Connecting to WebSocket", { url: fullUrl });

  return new Promise((resolve, reject) => {
    const logs: string[] = [];
    let lineCount = 0;
    let resolved = false;

    const ws = new WebSocket(fullUrl, {
      headers: {
        "x-api-key": config.authToken,
      },
    });

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close();
        logger.debug("WebSocket timeout reached", { lineCount });
        resolve(logs.join(""));
      }
    }, timeout);

    ws.on("open", () => {
      logger.debug("WebSocket connected");
    });

    ws.on("message", (data: WebSocket.RawData) => {
      if (resolved) return;

      const message = data.toString();
      logs.push(message);
      lineCount++;

      // Stop if we've collected enough lines
      if (lineCount >= maxLines) {
        resolved = true;
        clearTimeout(timeoutId);
        ws.close();
        resolve(logs.join(""));
      }
    });

    ws.on("error", (error: Error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        logger.error("WebSocket error", { error: error.message });
        reject(error);
      }
    });

    ws.on("close", () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        logger.debug("WebSocket closed", { lineCount });
        resolve(logs.join(""));
      }
    });
  });
}

/**
 * Fetch container logs via WebSocket
 */
export async function fetchContainerLogs(options: {
  containerId: string;
  tail?: number;
  since?: string;
  search?: string;
  timeout?: number;
}): Promise<string> {
  // Default to 24h for swarm mode (requires valid duration format)
  const { containerId, tail = 100, since = "24h", search = "", timeout = 5000 } = options;

  return fetchLogsViaWebSocket({
    endpoint: "docker-container-logs",
    params: {
      containerId,
      tail: tail.toString(),
      since,
      search,
      // Use swarm mode for Dokploy deployments
      runType: "swarm",
    },
    timeout,
    maxLines: tail,
  });
}

/**
 * Fetch deployment logs via WebSocket
 */
export async function fetchDeploymentLogs(options: {
  logPath: string;
  timeout?: number;
}): Promise<string> {
  const { logPath, timeout = 5000 } = options;

  return fetchLogsViaWebSocket({
    endpoint: "listen-deployment",
    params: {
      logPath,
    },
    timeout,
  });
}
