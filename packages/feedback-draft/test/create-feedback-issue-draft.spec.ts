import { describe, expect, it } from "vitest";

import { createFeedbackIssueDraft } from "../src/index";

describe("createFeedbackIssueDraft", () => {
  it("creates a maintainer-reviewed GitHub issue draft from structured human feedback", () => {
    const draft = createFeedbackIssueDraft({
      title: "Admin users cannot export CSV",
      source: "human",
      summary: "The export button never finishes.",
      expected: "A CSV file downloads after clicking export.",
      actual: "The spinner remains visible and no file is downloaded.",
      docsRead: ["apps/docs/src/content/docs/patterns/crud-resource.md"],
      commands: ["pnpm --filter admin test"],
      environment: {
        browser: "Chrome 125",
        node: "24.12.3"
      },
      logs: ["GET /api/users/export 500"],
      labels: [" Bug ", "bug", "Admin UI"]
    });

    expect(draft).toEqual({
      title: "Admin users cannot export CSV",
      source: "human",
      needsMaintainerReview: true,
      labels: ["bug", "admin-ui"],
      body: [
        "## Summary",
        "The export button never finishes.",
        "",
        "## Expected",
        "A CSV file downloads after clicking export.",
        "",
        "## Actual",
        "The spinner remains visible and no file is downloaded.",
        "",
        "## Docs Read",
        "- apps/docs/src/content/docs/patterns/crud-resource.md",
        "",
        "## Commands",
        "- `pnpm --filter admin test`",
        "",
        "## Environment",
        "- browser: Chrome 125",
        "- node: 24.12.3",
        "",
        "## Logs",
        "```text",
        "GET /api/users/export 500",
        "```"
      ].join("\n")
    });
  });

  it("maps agent sources and falls back to triage labels", () => {
    const draft = createFeedbackIssueDraft({
      title: "Generated client drift",
      source: "agent",
      summary: "OpenAPI generation produced unexpected changes.",
      labels: ["", "   "]
    });

    expect(draft.source).toBe("agent");
    expect(draft.labels).toEqual(["triage"]);
    expect(draft.needsMaintainerReview).toBe(true);
  });

  it("includes task context and reproduction details in the draft body", () => {
    const draft = createFeedbackIssueDraft({
      title: "Feedback draft needs richer context",
      source: "human",
      summary: "The draft should capture more structured context.",
      taskType: "mcp",
      stepsToReproduce: ["Open the feedback page", "Submit a draft issue"],
      relatedToolOrBoundary: "submit_feedback",
      agentContext: {
        agentName: "codex",
        docsRead: ["/feedback/", "/ai/mcp-server/"],
        verificationStatus: "partial",
        blockedReason: "Waiting for maintainer guidance"
      }
    });

    expect(draft.body).toContain("## Task Type");
    expect(draft.body).toContain("mcp");
    expect(draft.body).toContain("## Steps To Reproduce");
    expect(draft.body).toContain("- Open the feedback page");
    expect(draft.body).toContain("## Related MCP Tool Or Boundary");
    expect(draft.body).toContain("submit_feedback");
    expect(draft.body).toContain("## Agent Context");
    expect(draft.body).toContain("agentName: codex");
    expect(draft.body).toContain("verificationStatus: partial");
  });

  it("rejects private paths and internal docs sources", () => {
    expect(() =>
      createFeedbackIssueDraft({
        title: "Private material leaked",
        source: "human",
        summary: "This should be rejected.",
        docsRead: ["docs/superpowers/specs/example.md"]
      })
    ).toThrow(/private or internal/i);

    expect(() =>
      createFeedbackIssueDraft({
        title: "Env path leaked",
        source: "human",
        summary: "This should be rejected.",
        logs: ["See .env.local for details"]
      })
    ).toThrow(/private or internal/i);
  });
});
