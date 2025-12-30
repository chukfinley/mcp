import { z } from "zod";
import apiClient from "../../../utils/apiClient.js";
import { fetchDeploymentLogs } from "../../../utils/wsClient.js";
import { createTool } from "../toolFactory.js";
import { ResponseFormatter } from "../../../utils/responseFormatter.js";

export const deploymentLogs = createTool({
  name: "deployment-readLogs",
  description:
    "Reads the build/deployment logs for a specific deployment in Dokploy. Returns the log content from the deployment process.",
  schema: z.object({
    applicationId: z
      .string()
      .min(1)
      .describe("The ID of the application to get deployment logs for."),
    deploymentId: z
      .string()
      .optional()
      .describe(
        "The ID of a specific deployment. If not provided, gets logs from the most recent deployment."
      ),
  }),
  annotations: {
    title: "Read Deployment Logs",
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  handler: async (input) => {
    // Get the application with its deployments
    const appResponse = await apiClient.get(
      `/application.one?applicationId=${input.applicationId}`
    );

    if (!appResponse?.data) {
      return ResponseFormatter.error(
        "Failed to fetch application",
        `Application with ID "${input.applicationId}" not found`
      );
    }

    const deployments = appResponse.data.deployments;
    if (!deployments || deployments.length === 0) {
      return ResponseFormatter.error(
        "No deployments found",
        `Application "${appResponse.data.name}" has no deployments`
      );
    }

    // Find the specific deployment or use the most recent one
    let deployment;
    if (input.deploymentId) {
      deployment = deployments.find(
        (d: { deploymentId: string }) => d.deploymentId === input.deploymentId
      );
      if (!deployment) {
        return ResponseFormatter.error(
          "Deployment not found",
          `Deployment "${input.deploymentId}" not found in application "${appResponse.data.name}"`
        );
      }
    } else {
      // Get the most recent deployment (first in the array)
      deployment = deployments[0];
    }

    const logPath = deployment.logPath;
    if (!logPath) {
      return ResponseFormatter.error(
        "No log path available",
        `Deployment "${deployment.deploymentId}" does not have a log path`
      );
    }

    try {
      // Fetch logs via WebSocket
      const logs = await fetchDeploymentLogs({
        logPath,
        timeout: 10000,
      });

      if (!logs || logs.trim() === "") {
        return ResponseFormatter.success(
          `No logs found for deployment "${deployment.deploymentId}"`,
          {
            logs: "(no logs available)",
            deploymentId: deployment.deploymentId,
            status: deployment.status,
            title: deployment.title,
          }
        );
      }

      return ResponseFormatter.success(
        `Successfully fetched logs for deployment "${deployment.deploymentId}"`,
        {
          logs,
          deploymentId: deployment.deploymentId,
          status: deployment.status,
          title: deployment.title,
          createdAt: deployment.createdAt,
          lineCount: logs.split("\n").length,
        }
      );
    } catch (error) {
      return ResponseFormatter.error(
        "Failed to fetch deployment logs",
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});
