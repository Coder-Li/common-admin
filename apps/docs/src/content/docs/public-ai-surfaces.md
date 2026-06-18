---
title: Public AI Surfaces
description: Public docs, llms files, MCP tools, prompts, skills, feedback, and CI checks.
draft: false
---

Common Admin exposes several public surfaces for humans and AI agents. Keep
them consistent whenever the documented architecture or workflow changes.

## Surfaces

Public docs:

```text
apps/docs/src/content/docs/
```

AI index files:

```text
apps/docs/public/llms.txt
apps/docs/public/llms-full.txt
```

MCP server:

```text
packages/mcp-server/
```

Feedback draft package:

```text
packages/feedback-draft/
```

Issue templates and CI:

```text
.github/ISSUE_TEMPLATE/
.github/workflows/public-ai-surfaces.yml
```

## Update Rules

When adding a public doc page:

1. Add the Markdown page under the docs content directory.
2. Add it to the Starlight sidebar if humans should navigate to it.
3. Link it from the relevant entry pages.
4. Update `llms.txt` and `llms-full.txt` when agents should see it.
5. Add it to the MCP docs allowlist if MCP clients should read it.
6. Update MCP tests when allowlist behavior changes.

Do not add internal process notes, environment files, repository metadata,
dependency folders, or generated build output to any public AI surface.

## MCP Boundary

The MCP server reads allowlisted public Markdown and public AI text files. It
should reject unknown slugs rather than resolving filesystem paths.

The MCP server should not:

- execute package scripts;
- run migrations;
- mutate source files;
- read generated docs output;
- read environment files;
- read dependencies;
- read repository metadata;
- expose internal process docs.

## CI Gate

The public AI surfaces workflow checks:

```bash
pnpm --filter docs build
pnpm --filter @common-admin/feedback-draft test
pnpm --filter @common-admin/mcp-server test
pnpm --filter @common-admin/mcp-server typecheck
```

This is a lightweight public-surface gate. It does not replace `pnpm quality`
for implementation branches.

## Verification

For docs-only changes:

```bash
pnpm --filter docs build
```

For MCP, prompt, feedback, or allowlist changes:

```bash
pnpm --filter @common-admin/mcp-server test
pnpm --filter @common-admin/mcp-server typecheck
```

For branch readiness:

```bash
pnpm quality
```
