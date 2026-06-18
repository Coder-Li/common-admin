---
title: MCP Server
description: Local MCP interface for AI agents working with Common Admin.
draft: false
---

The Common Admin MCP server exposes documentation and project protocols to agents without forcing them to scrape the rendered site.

Version 1 is deliberately small. It reads allowlisted public docs, returns stable
public task prompts, and prepares issue drafts from structured feedback. It does
not mutate repository source, run migrations, execute arbitrary package scripts,
create GitHub issues automatically, or expose internal files.

## Run Locally

From the repository root:

```bash
pnpm --silent mcp:stdio
```

Equivalent package command:

```bash
pnpm --silent --filter @common-admin/mcp-server stdio
```

Example MCP client configuration:

```json
{
  "mcpServers": {
    "common-admin": {
      "command": "pnpm",
      "args": ["--silent", "mcp:stdio"],
      "cwd": "/absolute/path/to/common-admin"
    }
  }
}
```

The current local server exposes:

- `submit_feedback`: prepare structured feedback for maintainers.
- `list_common_admin_docs`: list public docs available through the MCP server.
- `read_common_admin_doc`: read an allowlisted public document by slug.
- `list_common_admin_patterns`: list available implementation patterns.
- `get_common_admin_prompt`: return a stable public task prompt.

## V1 Tool Boundary

Allowed v1 behavior:

- List and read public Markdown docs.
- Return source-attributed content.
- Return stable task prompts from public docs.
- List public pattern guides.
- Validate feedback input against the public feedback shape.
- Generate a GitHub issue draft title/body/labels for the maintainer to review.

Denied v1 behavior:

- Automatically create GitHub issues.
- Read or return environment files.
- Read or return repository metadata from `.git/**`.
- Read or return dependencies from `node_modules/**`.
- Read or return generated docs build output.
- Read, summarize, or expose internal process docs.
- Execute migrations, package scripts, tests, or arbitrary shell commands.
- Modify project files.

## Design Rules

- Read Markdown source files, not rendered HTML.
- Expose only allowlisted public docs from the docs app and public AI text files.
- Do not expose internal process notes, local environment files, repository metadata, dependency folders, or generated docs output.
- Return concise, source-attributed results.
- Keep prompts versioned with the documentation.

## Allowlist

The MCP server may read:

```text
apps/docs/src/content/docs/introduction.md
apps/docs/src/content/docs/getting-started.md
apps/docs/src/content/docs/architecture.md
apps/docs/src/content/docs/faq.md
apps/docs/src/content/docs/deployment.md
apps/docs/src/content/docs/upgrade-guide.md
apps/docs/src/content/docs/release-checklist.md
apps/docs/src/content/docs/auth-and-sessions.md
apps/docs/src/content/docs/session-management.md
apps/docs/src/content/docs/errors-and-logging.md
apps/docs/src/content/docs/diagnostics-and-health.md
apps/docs/src/content/docs/audit-logs.md
apps/docs/src/content/docs/settings.md
apps/docs/src/content/docs/file-management.md
apps/docs/src/content/docs/quality-gates.md
apps/docs/src/content/docs/troubleshooting.md
apps/docs/src/content/docs/resource-workflow.md
apps/docs/src/content/docs/public-ai-surfaces.md
apps/docs/src/content/docs/users-roles-permissions.md
apps/docs/src/content/docs/organization-structure.md
apps/docs/src/content/docs/data-permissions.md
apps/docs/src/content/docs/dictionaries.md
apps/docs/src/content/docs/ai/index.md
apps/docs/src/content/docs/ai/mcp-server.md
apps/docs/src/content/docs/ai/skill.md
apps/docs/src/content/docs/ai/prompts.md
apps/docs/src/content/docs/feedback.md
apps/docs/src/content/docs/patterns/api-contract.md
apps/docs/src/content/docs/patterns/crud-resource.md
apps/docs/src/content/docs/patterns/rbac.md
apps/docs/public/llms.txt
apps/docs/public/llms-full.txt
```

## Denylist

The MCP server must not read or expose:

```text
docs/superpowers/**
docs/next-step.md
.env*
.git/**
node_modules/**
apps/docs/dist/**
apps/docs/.astro/**
```

Do not add a path to the allowlist just because it exists in the repository. It should be stable, public, and safe for developer and AI-agent consumption.

## Documentation Tools

Use `list_common_admin_docs` to discover available slugs. Current slugs include:

```text
introduction
getting-started
architecture
faq
deployment
upgrade-guide
release-checklist
auth-and-sessions
session-management
errors-and-logging
diagnostics-and-health
audit-logs
settings
file-management
quality-gates
troubleshooting
resource-workflow
public-ai-surfaces
users-roles-permissions
organization-structure
data-permissions
dictionaries
ai
ai/mcp-server
ai/skill
ai/prompts
feedback
patterns/api-contract
patterns/crud-resource
patterns/rbac
llms
llms-full
```

Use `read_common_admin_doc` with one of those slugs:

```json
{
  "slug": "patterns/api-contract"
}
```

The result includes the slug, title, source path, kind, and document content.
Unknown slugs are rejected instead of being resolved as filesystem paths.

Use `list_common_admin_patterns` when an agent needs the implementation pattern
menu before selecting a task-specific guide.

## Prompt Tool

Use `get_common_admin_prompt` with one of these prompt ids:

```text
new_admin_resource
change_api_contract
bootstrap_project
update_docs_ai_surfaces
```

The result includes the prompt id, title, required public docs, and prompt text.
Unknown prompt ids are rejected.

## `submit_feedback`

`submit_feedback` only generates a draft. It accepts the public feedback shape
from [/feedback/](/feedback/) and returns:

- `title`
- `body`
- `labels`
- `source`
- `needsMaintainerReview: true`

The draft body should include:

- What the user tried to build.
- Which command, page, or document was confusing.
- What the agent or developer expected.
- What actually happened.
- Any error output or broken generated code.
- Relevant environment details when available.

Suggested labels should follow the public feedback categories:

- `docs`
- `ai`
- `mcp`
- `starter`
- `bug`
- `feature`
- `feedback`
- `needs-triage`

A human maintainer should review and submit the issue manually.

## First Configuration Shape

The first MCP version can be local-only. A later remote server can follow once public usage patterns are clearer.
