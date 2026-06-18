import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  getCommonAdminPrompt,
  listCommonAdminDocs,
  listCommonAdminPatterns,
  readCommonAdminDoc
} from "./docs.js";
import { submitFeedback } from "./submit-feedback.js";

const sourceSchema = z.enum(["human", "agent"]);

const feedbackInputSchema = {
  title: z.string().min(1),
  source: sourceSchema,
  summary: z.string().min(1),
  taskType: z.string().optional(),
  expected: z.string().optional(),
  actual: z.string().optional(),
  stepsToReproduce: z.array(z.string()).optional(),
  relatedToolOrBoundary: z.string().optional(),
  docsRead: z.array(z.string()).optional(),
  commands: z.array(z.string()).optional(),
  environment: z.record(z.string(), z.string()).optional(),
  logs: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  agentContext: z
    .object({
      agentName: z.string().optional(),
      docsRead: z.array(z.string()).optional(),
      verificationStatus: z.string().optional(),
      blockedReason: z.string().optional()
    })
    .optional()
};

export function createCommonAdminMcpServer(): McpServer {
  const server = new McpServer({
    name: "common-admin",
    version: "0.0.0"
  });

  server.registerTool(
    "submit_feedback",
    {
      title: "Submit Feedback",
      description:
        "Prepare a maintainer-reviewed GitHub issue draft from structured Common Admin feedback.",
      inputSchema: feedbackInputSchema
    },
    (input) => submitFeedback(input)
  );

  server.registerTool(
    "list_common_admin_docs",
    {
      title: "List Common Admin Docs",
      description: "List public allowlisted Common Admin docs available through this MCP server.",
      inputSchema: {}
    },
    () => listCommonAdminDocs()
  );

  server.registerTool(
    "read_common_admin_doc",
    {
      title: "Read Common Admin Doc",
      description: "Read one public allowlisted Common Admin doc by slug.",
      inputSchema: {
        slug: z.string().min(1)
      }
    },
    (input) => readCommonAdminDoc(input)
  );

  server.registerTool(
    "list_common_admin_patterns",
    {
      title: "List Common Admin Patterns",
      description: "List public Common Admin implementation pattern docs.",
      inputSchema: {}
    },
    () => listCommonAdminPatterns()
  );

  server.registerTool(
    "get_common_admin_prompt",
    {
      title: "Get Common Admin Prompt",
      description: "Return a stable public Common Admin task prompt.",
      inputSchema: {
        prompt: z.enum([
          "new_admin_resource",
          "change_api_contract",
          "bootstrap_project",
          "update_docs_ai_surfaces"
        ])
      }
    },
    (input) => getCommonAdminPrompt(input)
  );

  return server;
}

export {
  getCommonAdminPrompt,
  listCommonAdminDocs,
  listCommonAdminPatterns,
  readCommonAdminDoc
} from "./docs.js";
export type {
  CommonAdminPrompt,
  GetCommonAdminPromptInput,
  GetCommonAdminPromptResult,
  ListCommonAdminDocsResult,
  ListCommonAdminPatternsResult,
  ReadCommonAdminDocInput,
  ReadCommonAdminDocResult
} from "./docs.js";
export { submitFeedback } from "./submit-feedback.js";
export type { SubmitFeedbackInput, SubmitFeedbackResult } from "./submit-feedback.js";
