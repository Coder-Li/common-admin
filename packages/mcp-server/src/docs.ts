import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type McpTextResult<TStructuredContent> = {
  content: Array<{
    type: "text";
    text: string;
  }>;
  structuredContent: TStructuredContent;
};

type PublicDoc = {
  slug: string;
  title: string;
  source: string;
  kind: "doc" | "pattern" | "llms";
};

type PublicDocSlug =
  | "introduction"
  | "getting-started"
  | "architecture"
  | "faq"
  | "troubleshooting"
  | "deployment"
  | "upgrade-guide"
  | "release-checklist"
  | "auth-and-sessions"
  | "session-management"
  | "errors-and-logging"
  | "diagnostics-and-health"
  | "audit-logs"
  | "settings"
  | "file-management"
  | "quality-gates"
  | "resource-workflow"
  | "public-ai-surfaces"
  | "users-roles-permissions"
  | "organization-structure"
  | "data-permissions"
  | "dictionaries"
  | "ai"
  | "ai/mcp-server"
  | "ai/skill"
  | "ai/prompts"
  | "feedback"
  | "patterns/api-contract"
  | "patterns/crud-resource"
  | "patterns/rbac"
  | "llms"
  | "llms-full";

export type ListCommonAdminDocsResult = McpTextResult<{
  docs: PublicDoc[];
}>;

export type ReadCommonAdminDocInput = {
  slug: string;
};

export type ReadCommonAdminDocResult = McpTextResult<
  PublicDoc & {
    content: string;
  }
>;

export type ListCommonAdminPatternsResult = McpTextResult<{
  patterns: PublicDoc[];
}>;

export type GetCommonAdminPromptInput = {
  prompt: string;
};

export type CommonAdminPrompt = {
  prompt: string;
  title: string;
  requiredDocs: string[];
  text: string;
};

export type GetCommonAdminPromptResult = McpTextResult<CommonAdminPrompt>;

export type CommonAdminPromptKey =
  | "new_admin_resource"
  | "change_api_contract"
  | "bootstrap_project"
  | "update_docs_ai_surfaces";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const publicDocs = [
  {
    slug: "introduction",
    title: "Introduction",
    source: "apps/docs/src/content/docs/introduction.md",
    kind: "doc"
  },
  {
    slug: "getting-started",
    title: "Getting Started",
    source: "apps/docs/src/content/docs/getting-started.md",
    kind: "doc"
  },
  {
    slug: "architecture",
    title: "Architecture",
    source: "apps/docs/src/content/docs/architecture.md",
    kind: "doc"
  },
  {
    slug: "faq",
    title: "FAQ",
    source: "apps/docs/src/content/docs/faq.md",
    kind: "doc"
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    source: "apps/docs/src/content/docs/troubleshooting.md",
    kind: "doc"
  },
  {
    slug: "deployment",
    title: "Deployment",
    source: "apps/docs/src/content/docs/deployment.md",
    kind: "doc"
  },
  {
    slug: "upgrade-guide",
    title: "Upgrade Guide",
    source: "apps/docs/src/content/docs/upgrade-guide.md",
    kind: "doc"
  },
  {
    slug: "release-checklist",
    title: "Release Checklist",
    source: "apps/docs/src/content/docs/release-checklist.md",
    kind: "doc"
  },
  {
    slug: "auth-and-sessions",
    title: "Auth And Sessions",
    source: "apps/docs/src/content/docs/auth-and-sessions.md",
    kind: "doc"
  },
  {
    slug: "session-management",
    title: "Session Management",
    source: "apps/docs/src/content/docs/session-management.md",
    kind: "doc"
  },
  {
    slug: "errors-and-logging",
    title: "Errors And Logging",
    source: "apps/docs/src/content/docs/errors-and-logging.md",
    kind: "doc"
  },
  {
    slug: "diagnostics-and-health",
    title: "Diagnostics And Health",
    source: "apps/docs/src/content/docs/diagnostics-and-health.md",
    kind: "doc"
  },
  {
    slug: "audit-logs",
    title: "Audit Logs",
    source: "apps/docs/src/content/docs/audit-logs.md",
    kind: "doc"
  },
  {
    slug: "settings",
    title: "Settings",
    source: "apps/docs/src/content/docs/settings.md",
    kind: "doc"
  },
  {
    slug: "file-management",
    title: "File Management",
    source: "apps/docs/src/content/docs/file-management.md",
    kind: "doc"
  },
  {
    slug: "quality-gates",
    title: "Quality Gates",
    source: "apps/docs/src/content/docs/quality-gates.md",
    kind: "doc"
  },
  {
    slug: "resource-workflow",
    title: "Resource Workflow",
    source: "apps/docs/src/content/docs/resource-workflow.md",
    kind: "doc"
  },
  {
    slug: "public-ai-surfaces",
    title: "Public AI Surfaces",
    source: "apps/docs/src/content/docs/public-ai-surfaces.md",
    kind: "doc"
  },
  {
    slug: "users-roles-permissions",
    title: "Users Roles And Permissions",
    source: "apps/docs/src/content/docs/users-roles-permissions.md",
    kind: "doc"
  },
  {
    slug: "organization-structure",
    title: "Organization Structure",
    source: "apps/docs/src/content/docs/organization-structure.md",
    kind: "doc"
  },
  {
    slug: "data-permissions",
    title: "Data Permissions",
    source: "apps/docs/src/content/docs/data-permissions.md",
    kind: "doc"
  },
  {
    slug: "dictionaries",
    title: "Dictionaries",
    source: "apps/docs/src/content/docs/dictionaries.md",
    kind: "doc"
  },
  {
    slug: "ai",
    title: "AI Guide",
    source: "apps/docs/src/content/docs/ai/index.md",
    kind: "doc"
  },
  {
    slug: "ai/mcp-server",
    title: "MCP Server",
    source: "apps/docs/src/content/docs/ai/mcp-server.md",
    kind: "doc"
  },
  {
    slug: "ai/skill",
    title: "Skill",
    source: "apps/docs/src/content/docs/ai/skill.md",
    kind: "doc"
  },
  {
    slug: "ai/prompts",
    title: "Prompts",
    source: "apps/docs/src/content/docs/ai/prompts.md",
    kind: "doc"
  },
  {
    slug: "feedback",
    title: "Feedback",
    source: "apps/docs/src/content/docs/feedback.md",
    kind: "doc"
  },
  {
    slug: "patterns/api-contract",
    title: "API Contract",
    source: "apps/docs/src/content/docs/patterns/api-contract.md",
    kind: "pattern"
  },
  {
    slug: "patterns/crud-resource",
    title: "CRUD Resource",
    source: "apps/docs/src/content/docs/patterns/crud-resource.md",
    kind: "pattern"
  },
  {
    slug: "patterns/rbac",
    title: "RBAC",
    source: "apps/docs/src/content/docs/patterns/rbac.md",
    kind: "pattern"
  },
  {
    slug: "llms",
    title: "LLMS",
    source: "apps/docs/public/llms.txt",
    kind: "llms"
  },
  {
    slug: "llms-full",
    title: "LLMS Full",
    source: "apps/docs/public/llms-full.txt",
    kind: "llms"
  }
] as const satisfies readonly PublicDoc[];

const publicDocBySlug = new Map<string, PublicDoc>(
  publicDocs.map((doc) => [doc.slug, doc])
);

const prompts = {
  new_admin_resource: {
    prompt: "new_admin_resource",
    title: "Add An Admin Resource",
    requiredDocs: [
      "/architecture/",
      "/patterns/crud-resource/",
      "/patterns/api-contract/",
      "/patterns/rbac/",
      "/ai/prompts/"
    ],
    text: [
      "Add a new API-backed admin resource to Common Admin.",
      "",
      "Before editing, read the public docs for architecture, API contract generation,",
      "CRUD resources, and RBAC permissions. Follow existing module patterns. Use",
      "backend DTOs and Swagger metadata as the API contract source, regenerate the",
      "frontend API, and use generated helpers in the admin app. Add focused tests and",
      "run the relevant quality gates."
    ].join("\n")
  },
  change_api_contract: {
    prompt: "change_api_contract",
    title: "Change An API Contract",
    requiredDocs: ["/architecture/", "/patterns/api-contract/", "/ai/prompts/"],
    text: [
      "Change an existing API contract in Common Admin.",
      "",
      "Update backend DTOs, validation, mappers, controller metadata, and tests first.",
      "Regenerate OpenAPI and frontend API artifacts. Do not hand edit generated files.",
      "Update frontend usages through generated types and functions. Run the API drift",
      "check before finishing."
    ].join("\n")
  },
  bootstrap_project: {
    prompt: "bootstrap_project",
    title: "Bootstrap A New Project",
    requiredDocs: ["/introduction/", "/getting-started/", "/architecture/", "/ai/"],
    text: [
      "Bootstrap a product from Common Admin.",
      "",
      "Keep authentication, RBAC, generated API flow, and quality gates intact unless",
      "the human maintainer explicitly changes the architecture. Rename product-facing",
      "labels and environment values, then add business modules through the documented",
      "CRUD and permission patterns."
    ].join("\n")
  },
  update_docs_ai_surfaces: {
    prompt: "update_docs_ai_surfaces",
    title: "Update Docs / AI Entry Surfaces",
    requiredDocs: [
      "/introduction/",
      "/architecture/",
      "/faq/",
      "/troubleshooting/",
      "/release-checklist/",
      "/quality-gates/",
      "/public-ai-surfaces/",
      "/ai/",
      "/ai/mcp-server/",
      "/ai/skill/",
      "/feedback/"
    ],
    text: [
      "Update the Common Admin public docs or AI entry surfaces.",
      "",
      "Keep public docs focused on stable architecture, workflows, and agent guidance.",
      "Do not expose internal process materials, environment files, repository metadata,",
      "dependencies, or generated build output. When summarizing patterns, write stable",
      "summaries rather than copying internal plans or specs."
    ].join("\n")
  }
} as const satisfies Record<CommonAdminPromptKey, CommonAdminPrompt>;

function asTextResult<TStructuredContent>(
  structuredContent: TStructuredContent,
  text: string
): McpTextResult<TStructuredContent> {
  return {
    content: [
      {
        type: "text",
        text
      }
    ],
    structuredContent
  };
}

function formatDocList(docs: readonly PublicDoc[]): string {
  return docs.map((doc) => `- ${doc.slug}: ${doc.title} (${doc.source})`).join("\n");
}

export async function listCommonAdminDocs(): Promise<ListCommonAdminDocsResult> {
  const docs = [...publicDocs];

  return asTextResult(
    { docs },
    ["Public Common Admin docs:", formatDocList(docs)].join("\n")
  );
}

export async function readCommonAdminDoc(input: ReadCommonAdminDocInput): Promise<ReadCommonAdminDocResult> {
  const doc = publicDocBySlug.get(input.slug);

  if (!doc) {
    throw new Error(`Unknown public Common Admin doc: ${input.slug}`);
  }

  const content = await readFile(resolve(repoRoot, doc.source), "utf8");
  const structuredContent = {
    ...doc,
    content
  };

  return asTextResult(
    structuredContent,
    [`Source: ${doc.source}`, "", content].join("\n")
  );
}

export async function listCommonAdminPatterns(): Promise<ListCommonAdminPatternsResult> {
  const patterns = publicDocs.filter((doc) => doc.kind === "pattern");

  return asTextResult(
    { patterns },
    ["Common Admin implementation patterns:", formatDocList(patterns)].join("\n")
  );
}

export async function getCommonAdminPrompt(
  input: GetCommonAdminPromptInput
): Promise<GetCommonAdminPromptResult> {
  const prompt = prompts[input.prompt as CommonAdminPromptKey];

  if (!prompt) {
    throw new Error(`Unknown Common Admin prompt: ${input.prompt}`);
  }

  return asTextResult(
    prompt,
    [`Prompt: ${prompt.title}`, `Required docs: ${prompt.requiredDocs.join(", ")}`, "", prompt.text].join("\n")
  );
}
