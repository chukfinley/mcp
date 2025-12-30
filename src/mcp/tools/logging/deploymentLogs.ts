import { z } from "zod";
import apiClient from "../../../utils/apiClient.js";
import { createTool } from "../toolFactory.js";
import { ResponseFormatter } from "../../../utils/responseFormatter.js";

export const deploymentLogs = createTool({
  name: "deployment-readLogs",
  description:
    "Reads the build/deployment logs for a specific deployment in Dokploy. Returns the log content from the deployment process.",
  schema: z.object({
    deploymentId: z
      .string()
      .min(1)
      .describe("The ID of the deployment to retrieve logs for."),
    tail: z
      .number()
      .optional()
      .describe(
        "Number of lines to return from the end of the log. If not specified, returns all logs."
      ),
  }),
  annotations: {
    title: "Read Deployment Logs",
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  handler: async (input) => {
    const params = new URLSearchParams({
      deploymentId: input.deploymentId,
    });

    if (input.tail !== undefined) {
      params.append("tail", input.tail.toString());
    }

    const response = await apiClient.get(
      `/deployment.readLogs?${params.toString()}`
    );

    if (!response?.data) {
      return ResponseFormatter.error(
        "Failed to fetch deployment logs",
        `Could not retrieve logs for deployment "${input.deploymentId}"`
      );
    }

    return ResponseFormatter.success(
      `Successfully fetched logs for deployment "${input.deploymentId}"`,
      response.data
    );
  },
});
