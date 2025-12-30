import { z } from "zod";
import apiClient from "../../../utils/apiClient.js";
import { createTool } from "../toolFactory.js";
import { ResponseFormatter } from "../../../utils/responseFormatter.js";

export const composeLogs = createTool({
  name: "compose-readLogs",
  description:
    "Reads the runtime container logs for a Docker Compose service in Dokploy. Returns the stdout/stderr output from the running containers.",
  schema: z.object({
    composeId: z
      .string()
      .min(1)
      .describe("The ID of the compose stack to retrieve logs for."),
    serviceName: z
      .string()
      .optional()
      .describe(
        "The name of a specific service within the compose stack. If not specified, returns logs from all services."
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
        "Only return logs since this time. Can be a duration (e.g., '1h', '30m', '2h30m') or a timestamp. Defaults to all logs."
      ),
    timestamps: z
      .boolean()
      .optional()
      .describe("Whether to include timestamps in the log output. Defaults to true."),
  }),
  annotations: {
    title: "Read Compose Service Logs",
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  handler: async (input) => {
    const params = new URLSearchParams({
      composeId: input.composeId,
    });

    if (input.serviceName !== undefined) {
      params.append("serviceName", input.serviceName);
    }

    if (input.tail !== undefined) {
      params.append("tail", input.tail.toString());
    }

    if (input.since !== undefined) {
      params.append("since", input.since);
    }

    if (input.timestamps !== undefined) {
      params.append("timestamps", input.timestamps.toString());
    }

    const response = await apiClient.get(
      `/compose.readLogs?${params.toString()}`
    );

    if (!response?.data) {
      return ResponseFormatter.error(
        "Failed to fetch compose logs",
        `Could not retrieve logs for compose "${input.composeId}"`
      );
    }

    return ResponseFormatter.success(
      `Successfully fetched logs for compose "${input.composeId}"`,
      response.data
    );
  },
});
