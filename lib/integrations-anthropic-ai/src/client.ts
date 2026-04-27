import Anthropic from "@anthropic-ai/sdk";

if (!process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || !process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
  throw new Error(
    [
      "Anthropic AI integration is not provisioned in this workspace.",
      "",
      "Fix in one step: open the Replit chat and tell the agent:",
      "    \"set up the Anthropic integration\"",
      "",
      "The agent will run setupReplitAIIntegrations({ integrations: ['anthropic'] })",
      "and the env vars AI_INTEGRATIONS_ANTHROPIC_BASE_URL and",
      "AI_INTEGRATIONS_ANTHROPIC_API_KEY will be set automatically. Then restart",
      "the API Server workflow. Full instructions in SETUP.md.",
    ].join("\n"),
  );
}

export const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  // The SDK (>= 0.78) auto-attaches `anthropic-beta: web-search-2025-03-05`
  // (and other beta tokens) to outgoing requests. The Replit AI Integrations
  // proxy routes through Vertex AI, which rejects unrecognised beta tokens
  // with a 400 ("Unexpected value(s) `web-search-2025-03-05` for the
  // `anthropic-beta` header"). That 400 happens BEFORE the model ever sees
  // the request, so every conversation — even a single write_file — fails.
  // Setting the header to null tells the SDK to drop it entirely.
  defaultHeaders: {
    "anthropic-beta": null,
  },
});
