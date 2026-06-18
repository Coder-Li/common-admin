export type FeedbackSource = "human" | "agent";

export type FeedbackDraftInput = {
  title: string;
  source: FeedbackSource | string;
  summary: string;
  taskType?: string;
  expected?: string;
  actual?: string;
  stepsToReproduce?: string[];
  relatedToolOrBoundary?: string;
  docsRead?: string[];
  commands?: string[];
  environment?: Record<string, string>;
  logs?: string[];
  labels?: string[];
  agentContext?: {
    agentName?: string;
    docsRead?: string[];
    verificationStatus?: string;
    blockedReason?: string;
  };
};

export type FeedbackIssueDraft = {
  title: string;
  body: string;
  labels: string[];
  source: FeedbackSource;
  needsMaintainerReview: true;
};

const INTERNAL_PATH_PATTERNS = [
  /(^|\/)docs\/superpowers(\/|$)/i,
  /(^|\/)docs\/next-step\.md$/i,
  /\.env([^/]*|$)/i,
  /(^|\/)\.git(\/|$)/i,
  /(^|\/)node_modules(\/|$)/i,
  /(^|\/)apps\/docs\/dist(\/|$)/i,
  /(^|\/)apps\/docs\/\.astro(\/|$)/i
];

const INTERNAL_DOC_SOURCE_PATTERNS = [
  /docs\/superpowers/i,
  /docs\/next-step\.md/i,
  /llms/i
];

export function createFeedbackIssueDraft(
  input: FeedbackDraftInput
): FeedbackIssueDraft {
  const source = normalizeSource(input.source);
  const sections = [section("Summary", input.summary)];

  if (input.taskType) sections.push(section("Task Type", input.taskType));
  if (input.expected) sections.push(section("Expected", input.expected));
  if (input.actual) sections.push(section("Actual", input.actual));
  if (input.stepsToReproduce?.length) {
    sections.push(listSection("Steps To Reproduce", input.stepsToReproduce));
  }
  if (input.relatedToolOrBoundary) {
    sections.push(section("Related MCP Tool Or Boundary", input.relatedToolOrBoundary));
  }
  if (input.docsRead?.length) sections.push(listSection("Docs Read", input.docsRead));
  if (input.commands?.length) sections.push(listSection("Commands", input.commands, true));
  if (input.environment && Object.keys(input.environment).length) {
    sections.push(
      listSection(
        "Environment",
        Object.entries(input.environment).map(([key, value]) => `${key}: ${value}`)
      )
    );
  }
  if (input.agentContext && Object.keys(input.agentContext).length) {
    sections.push(listSection("Agent Context", formatAgentContext(input.agentContext)));
  }
  if (input.logs?.length) sections.push(codeSection("Logs", input.logs));

  validateSafeContent(compact([input.taskType, input.summary, input.expected, input.actual]));
  validateSafeContent(input.stepsToReproduce);
  validateSafeContent(compact([input.relatedToolOrBoundary]));
  validateSafeContent(input.docsRead);
  validateSafeContent(input.commands);
  validateSafeContent(input.logs);
  validateSafeContent(input.agentContext?.docsRead);
  validateSafeContent(compact([
    input.agentContext?.agentName,
    input.agentContext?.verificationStatus,
    input.agentContext?.blockedReason
  ]));

  return {
    title: input.title,
    body: sections.join("\n\n"),
    labels: normalizeLabels(input.labels),
    source,
    needsMaintainerReview: true
  };
}

function normalizeSource(source: FeedbackDraftInput["source"]): FeedbackSource {
  if (source === "human" || source === "agent") return source;
  return "human";
}

function normalizeLabels(labels?: string[]): string[] {
  const normalized = new Set<string>();
  for (const label of labels ?? []) {
    const value = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (value) normalized.add(value);
  }
  if (normalized.size === 0) normalized.add("triage");
  return [...normalized];
}

function section(title: string, content: string): string {
  return `## ${title}\n${content}`;
}

function listSection(title: string, items: string[], wrapCode = false): string {
  const lines = items.map((item) => `- ${wrapCode ? `\`${item}\`` : item}`);
  return `## ${title}\n${lines.join("\n")}`;
}

function codeSection(title: string, items: string[]): string {
  return `## ${title}\n\`\`\`text\n${items.join("\n")}\n\`\`\``;
}

function formatAgentContext(
  agentContext: NonNullable<FeedbackDraftInput["agentContext"]>
): string[] {
  const entries: string[] = [];
  if (agentContext.agentName) entries.push(`agentName: ${agentContext.agentName}`);
  if (agentContext.docsRead?.length) {
    entries.push(`docsRead: ${agentContext.docsRead.join(", ")}`);
  }
  if (agentContext.verificationStatus) {
    entries.push(`verificationStatus: ${agentContext.verificationStatus}`);
  }
  if (agentContext.blockedReason) entries.push(`blockedReason: ${agentContext.blockedReason}`);
  return entries;
}

function compact(values: Array<string | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value));
}

function validateSafeContent(values?: string[]): void {
  for (const value of values ?? []) {
    if (!value) continue;
    for (const pattern of INTERNAL_PATH_PATTERNS) {
      if (pattern.test(value)) {
        throw new Error("Feedback draft contains private or internal path content.");
      }
    }
    for (const pattern of INTERNAL_DOC_SOURCE_PATTERNS) {
      if (pattern.test(value)) {
        throw new Error("Feedback draft contains private or internal docs source content.");
      }
    }
  }
}
