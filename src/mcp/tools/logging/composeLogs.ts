import { z } from "zod";
import apiClient from "../../../utils/apiClient.js";
import { fetchContainerLogs } from "../../../utils/wsClient.js";
import { createTool } from "../toolFactory.js";
import { ResponseFormatter } from "../../../utils/responseFormatter.js";

export const composeLogs = createTool({
  name: "compose-readLogs",
  description:
    "Reads the runtime container logs for a Docker Compose service in Dokploy. Returns the stdout/stderr output from the running containers.",
  schema: z.object({
    composeId: z
      .string()
      .describe("The ID of the compose stack to retrieve logs for."),
    serviceName: z
      .string()
      .optional()
      .describe(
        "The name of a specific service within the compose stack. If not specified, returns logs from the main compose container."
      ),
    tail: z
      .number()
      .optional()
      .describe(
        "Number of lines to return from the end of the log. Defaults to 100 if not specified."
      ),
    since: z
      .string()
      .optional()
      .describe(
        "Only return logs since this time. Can be a duration (e.g., '1h', '30m') or 'all' for all logs. Defaults to 'all'."
      ),
    search: z
      .string()
      .optional()
      .describe("Filter logs by search term (case-insensitive)."),
  }),
  annotations: {
    title: "Read Compose Service Logs",
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  handler: async (input) => {
    // Get the compose stack info
    const composeResponse = await apiClient.get(
      `/compose.one?composeId=${input.composeId}`
    );

    if (!composeResponse?.data) {
      return ResponseFormatter.error(
        "Failed to fetch compose stack",
        `Compose stack with ID "${input.composeId}" not found`
      );
    }

    const appName = composeResponse.data.appName;
    if (!appName) {
      return ResponseFormatter.error(
        "Compose stack has no container",
        `Compose stack "${input.composeId}" does not have a running container`
      );
    }

    // Build the container name
    // For compose services, the container name is typically: appName-serviceName-1
    // If no service name specified, use the appName directly
    let containerId = appName;
    if (input.serviceName) {
      containerId = `${appName}-${input.serviceName}-1`;
    }

    try {
      // Fetch logs via WebSocket
      const logs = await fetchContainerLogs({
        containerId,
        tail: input.tail ?? 100,
        since: input.since ?? "all",
        search: input.search ?? "",
        timeout: 10000,
      });

      if (!logs || logs.trim() === "") {
        return ResponseFormatter.success(
          `No logs found for compose "${composeResponse.data.name}"${input.serviceName ? ` service "${input.serviceName}"` : ""}`,
          { logs: "(no logs available)", containerId }
        );
      }

      return ResponseFormatter.success(
        `Successfully fetched logs for compose "${composeResponse.data.name}"${input.serviceName ? ` service "${input.serviceName}"` : ""}`,
        {
          logs,
          containerId,
          composeName: composeResponse.data.name,
          serviceName: input.serviceName,
          lineCount: logs.split("\n").length,
        }
      );
    } catch (error) {
      return ResponseFormatter.error(
        "Failed to fetch compose logs",
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});
