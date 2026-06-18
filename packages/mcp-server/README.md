# Common Admin MCP Server

Local MCP server for Common Admin agent integrations.

Version 1 exposes a small public toolset:

- `submit_feedback`: converts structured feedback into a maintainer-reviewed
  GitHub issue draft.
- `list_common_admin_docs`: lists allowlisted public docs.
- `read_common_admin_doc`: reads one public doc by slug.
- `list_common_admin_patterns`: lists implementation pattern docs.
- `get_common_admin_prompt`: returns a stable public task prompt.

The server does not create GitHub issues, read private files, run package
scripts, execute migrations, or modify repository files.

## Run Locally

From the repository root:

```bash
pnpm --silent mcp:stdio
```

Equivalent package command:

```bash
pnpm --silent --filter @common-admin/mcp-server stdio
```

## MCP Client Configuration

Use a stdio MCP client configuration that runs the repository command from the
project root:

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

## Documentation Tools

List public docs:

```json
{}
```

Read a public doc:

```json
{
  "slug": "patterns/api-contract"
}
```

Supported prompt ids for `get_common_admin_prompt`:

```text
new_admin_resource
change_api_contract
bootstrap_project
update_docs_ai_surfaces
```

## Feedback Tool Input

`submit_feedback` accepts the public feedback shape:

```json
{
  "title": "Getting Started is missing Redis setup",
  "source": "human",
  "summary": "The API failed until Redis was started.",
  "taskType": "bootstrap",
  "expected": "The setup docs list required local services.",
  "actual": "Redis was not obvious from the first-run steps.",
  "stepsToReproduce": ["Run pnpm dev without Redis"],
  "docsRead": ["/getting-started/"],
  "commands": ["pnpm dev"],
  "labels": ["docs", "starter"]
}
```

The tool returns:

- `title`
- `body`
- `labels`
- `source`
- `needsMaintainerReview: true`

## Safety Boundary

Documentation reads use a fixed allowlist of public docs and public AI text
files. Unknown slugs are rejected instead of being resolved as filesystem paths.
The feedback draft generator also rejects references to internal or private
paths.

## Verification

```bash
pnpm --filter @common-admin/mcp-server test
pnpm --filter @common-admin/mcp-server typecheck
```
