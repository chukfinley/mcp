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

    const containerId = appName;

    try {
      // Fetch logs via WebSocket (uses swarm mode with 24h default)
      const logs = await fetchContainerLogs({
        containerId,
        tail: 100,
        timeout: 10000,
      });

      if (!logs || logs.trim() === "") {
        return ResponseFormatter.success(
          `No logs found for compose "${composeResponse.data.name}"`,
          { logs: "(no logs available)", containerId }
        );
      }

      return ResponseFormatter.success(
        `Successfully fetched logs for compose "${composeResponse.data.name}"`,
        {
          logs,
          containerId,
          composeName: composeResponse.data.name,
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
