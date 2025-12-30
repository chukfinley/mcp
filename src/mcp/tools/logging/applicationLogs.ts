import { z } from "zod";
import apiClient from "../../../utils/apiClient.js";
import { fetchContainerLogs } from "../../../utils/wsClient.js";
import { createTool } from "../toolFactory.js";
import { ResponseFormatter } from "../../../utils/responseFormatter.js";

export const applicationLogs = createTool({
  name: "application-readLogs",
  description:
    "Reads the runtime container logs for an application in Dokploy. Returns the stdout/stderr output from the running container.",
  schema: z.object({
    applicationId: z
      .string()
      .describe("The ID of the application to retrieve logs for."),
  }),
  annotations: {
    title: "Read Application Container Logs",
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  handler: async (input) => {
    // First, get the application to find its appName (container name)
    const appResponse = await apiClient.get(
      `/application.one?applicationId=${input.applicationId}`
    );

    if (!appResponse?.data) {
      return ResponseFormatter.error(
        "Failed to fetch application",
        `Application with ID "${input.applicationId}" not found`
      );
    }

    const appName = appResponse.data.appName;
    if (!appName) {
      return ResponseFormatter.error(
        "Application has no container",
        `Application "${input.applicationId}" does not have a running container`
      );
    }

    try {
      // Fetch logs via WebSocket
      const logs = await fetchContainerLogs({
        containerId: appName,
        tail: 100,
        since: "all",
        search: "",
        timeout: 10000,
      });

      if (!logs || logs.trim() === "") {
        return ResponseFormatter.success(
          `No logs found for application "${appResponse.data.name}"`,
          { logs: "(no logs available)", appName }
        );
      }

      return ResponseFormatter.success(
        `Successfully fetched logs for application "${appResponse.data.name}"`,
        { logs, appName, lineCount: logs.split("\n").length }
      );
    } catch (error) {
      return ResponseFormatter.error(
        "Failed to fetch application logs",
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});
