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
});
