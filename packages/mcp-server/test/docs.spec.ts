import { describe, expect, it } from "vitest";

import {
  getCommonAdminPrompt,
  listCommonAdminDocs,
  listCommonAdminPatterns,
  readCommonAdminDoc
} from "../src/docs";

describe("Common Admin public docs tools", () => {
  it("lists only public allowlisted docs", async () => {
    const result = await listCommonAdminDocs();

    expect(result.structuredContent.docs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "deployment",
          source: "apps/docs/src/content/docs/deployment.md"
        }),
        expect.objectContaining({
          slug: "auth-and-sessions",
          source: "apps/docs/src/content/docs/auth-and-sessions.md"
        }),
        expect.objectContaining({
          slug: "quality-gates",
          source: "apps/docs/src/content/docs/quality-gates.md"
        }),
        expect.objectContaining({
          slug: "troubleshooting",
          source: "apps/docs/src/content/docs/troubleshooting.md"
        }),
        expect.objectContaining({
          slug: "faq",
          source: "apps/docs/src/content/docs/faq.md"
        }),
        expect.objectContaining({
          slug: "upgrade-guide",
          source: "apps/docs/src/content/docs/upgrade-guide.md"
        }),
        expect.objectContaining({
          slug: "release-checklist",
          source: "apps/docs/src/content/docs/release-checklist.md"
        }),
        expect.objectContaining({
          slug: "session-management",
          source: "apps/docs/src/content/docs/session-management.md"
        }),
        expect.objectContaining({
          slug: "diagnostics-and-health",
          source: "apps/docs/src/content/docs/diagnostics-and-health.md"
        }),
        expect.objectContaining({
          slug: "users-roles-permissions",
          source: "apps/docs/src/content/docs/users-roles-permissions.md"
        }),
        expect.objectContaining({
          slug: "resource-workflow",
          source: "apps/docs/src/content/docs/resource-workflow.md"
        }),
        expect.objectContaining({
          slug: "public-ai-surfaces",
          source: "apps/docs/src/content/docs/public-ai-surfaces.md"
        }),
        expect.objectContaining({
          slug: "dictionaries",
          source: "apps/docs/src/content/docs/dictionaries.md"
        }),
        expect.objectContaining({
          slug: "patterns/api-contract",
          source: "apps/docs/src/content/docs/patterns/api-contract.md"
        }),
        expect.objectContaining({
          slug: "llms",
          source: "apps/docs/public/llms.txt"
        })
      ])
    );
    expect(result.content[0].text).toContain("patterns/api-contract");
    expect(result.content[0].text).not.toContain("docs/superpowers");
    expect(result.content[0].text).not.toContain(".env");
  });

  it("reads a public doc by slug with source attribution", async () => {
    const result = await readCommonAdminDoc({ slug: "patterns/rbac" });

    expect(result.structuredContent).toMatchObject({
      slug: "patterns/rbac",
      source: "apps/docs/src/content/docs/patterns/rbac.md"
    });
    expect(result.structuredContent.content).toContain("Common Admin uses permission codes");
    expect(result.content[0].text).toContain("Source: apps/docs/src/content/docs/patterns/rbac.md");
  });

  it("reads public operational docs by slug", async () => {
    const result = await readCommonAdminDoc({ slug: "auth-and-sessions" });

    expect(result.structuredContent).toMatchObject({
      slug: "auth-and-sessions",
      source: "apps/docs/src/content/docs/auth-and-sessions.md"
    });
    expect(result.structuredContent.content).toContain("401 Replay Rules");
  });

  it("reads public module docs by slug", async () => {
    const result = await readCommonAdminDoc({ slug: "users-roles-permissions" });

    expect(result.structuredContent).toMatchObject({
      slug: "users-roles-permissions",
      source: "apps/docs/src/content/docs/users-roles-permissions.md"
    });
    expect(result.structuredContent.content).toContain("user.assign_roles");
  });

  it("reads the public AI surfaces doc by slug", async () => {
    const result = await readCommonAdminDoc({ slug: "public-ai-surfaces" });

    expect(result.structuredContent).toMatchObject({
      slug: "public-ai-surfaces",
      source: "apps/docs/src/content/docs/public-ai-surfaces.md"
    });
    expect(result.structuredContent.content).toContain("lightweight public-surface gate");
  });

  it("reads the FAQ doc by slug", async () => {
    const result = await readCommonAdminDoc({ slug: "faq" });

    expect(result.structuredContent).toMatchObject({
      slug: "faq",
      source: "apps/docs/src/content/docs/faq.md"
    });
    expect(result.structuredContent.content).toContain("Should I edit generated API files?");
  });

  it("rejects path traversal and internal paths", async () => {
    await expect(readCommonAdminDoc({ slug: "../../docs/superpowers/spec" })).rejects.toThrow(
      "Unknown public Common Admin doc"
    );
    await expect(readCommonAdminDoc({ slug: "docs/next-step" })).rejects.toThrow(
      "Unknown public Common Admin doc"
    );
  });

  it("lists implementation patterns", async () => {
    const result = await listCommonAdminPatterns();

    expect(result.structuredContent.patterns.map((pattern) => pattern.slug)).toEqual([
      "patterns/api-contract",
      "patterns/crud-resource",
      "patterns/rbac"
    ]);
  });

  it("returns a stable public prompt", async () => {
    const result = await getCommonAdminPrompt({ prompt: "new_admin_resource" });

    expect(result.structuredContent.prompt).toBe("new_admin_resource");
    expect(result.structuredContent.requiredDocs).toEqual(
      expect.arrayContaining(["/patterns/crud-resource/", "/patterns/api-contract/", "/patterns/rbac/"])
    );
    expect(result.structuredContent.text).toContain("Add a new API-backed admin resource");
  });

  it("rejects unknown prompts", async () => {
    await expect(getCommonAdminPrompt({ prompt: "internal_next_step" })).rejects.toThrow(
      "Unknown Common Admin prompt"
    );
  });
});
