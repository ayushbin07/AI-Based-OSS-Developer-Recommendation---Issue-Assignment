/**
 * AI Provider Factory
 *
 * Returns the correct AIProvider implementation based on the AI_PROVIDER
 * environment variable. Defaults to "ollama" for local development.
 *
 * Usage:
 *   import { getAIProvider } from "@/lib/ai";
 *   const ai = getAIProvider();
 *   const result = await ai.embed("some text");
 *
 * Supported values for AI_PROVIDER:
 *   "ollama"  → OllamaProvider (local, default)
 *   "google"  → GoogleAIProvider (cloud)
 */

import type { AIProvider } from "./provider.interface";

let _instance: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  // Re-use the singleton within the same server process / request
  if (_instance) return _instance;

  const providerName = (process.env.AI_PROVIDER ?? "ollama").toLowerCase();

  switch (providerName) {
    case "ollama": {
      // Dynamic import to avoid loading Ollama code on Google deployments
      const { OllamaProvider } = require("./ollama.provider");
      _instance = new OllamaProvider();
      break;
    }
    case "google": {
      const { GoogleAIProvider } = require("./google.provider");
      _instance = new GoogleAIProvider();
      break;
    }
    default:
      throw new Error(
        `Unknown AI_PROVIDER "${providerName}". Valid values: "ollama", "google".`
      );
  }

  console.log(`[AI] Using provider: ${_instance!.name}`);
  return _instance!;
}

// Re-export the interface so callers only need one import path
export type { AIProvider, EmbeddingResult, CompletionMessage, CompletionResult, CompletionOptions } from "./provider.interface";
