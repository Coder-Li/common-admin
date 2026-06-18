import { describe, expect, it } from "vitest";

import { submitFeedback } from "../src/submit-feedback";

describe("submitFeedback", () => {
  it("returns a maintainer-reviewed issue draft as text and structured content", () => {
    const result = submitFeedback({
      title: "Docs prompt is unclear",
      source: "agent",
      summary: "The agent could not pick the right public prompt.",
      taskType: "docs",
      expected: "The prompt docs explain which task prompt to use.",
      actual: "The agent selected the bootstrap prompt.",
      docsRead: ["/ai/prompts/"],
      labels: ["ai", "docs"]
    });

    expect(result.structuredContent).toMatchObject({
      title: "Docs prompt is unclear",
      source: "agent",
      needsMaintainerReview: true,
      labels: ["ai", "docs"]
    });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
  });
});
