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
      .min(1)
      .describe("The ID of the application to retrieve logs for."),
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
        tail: input.tail ?? 100,
        since: input.since ?? "all",
        search: input.search ?? "",
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
