import { z } from "zod";
import apiClient from "../../../utils/apiClient.js";
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
        "Only return logs since this time. Can be a duration (e.g., '1h', '30m', '2h30m') or a timestamp. Defaults to all logs."
      ),
    timestamps: z
      .boolean()
      .optional()
      .describe("Whether to include timestamps in the log output. Defaults to true."),
  }),
  annotations: {
    title: "Read Application Container Logs",
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  handler: async (input) => {
    const params = new URLSearchParams({
      applicationId: input.applicationId,
    });

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
      `/application.readLogs?${params.toString()}`
    );

    if (!response?.data) {
      return ResponseFormatter.error(
        "Failed to fetch application logs",
        `Could not retrieve logs for application "${input.applicationId}"`
      );
    }

    return ResponseFormatter.success(
      `Successfully fetched logs for application "${input.applicationId}"`,
      response.data
    );
  },
});
