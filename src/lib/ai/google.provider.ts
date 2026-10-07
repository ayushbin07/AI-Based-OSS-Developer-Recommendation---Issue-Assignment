/**
 * GoogleAIProvider
 *
 * Implements AIProvider using the Google AI API (@google/genai SDK).
 * Used for the deployed/live version of the application.
 *
 * Required env vars:
 *   GOOGLE_AI_API_KEY      – Your Google AI API key
 *   GOOGLE_EMBED_MODEL     – e.g. gemini-embedding-001  (default)
 *   GOOGLE_CHAT_MODEL      – e.g. gemini-3.8-flash      (default)
 */

import { GoogleGenAI } from "@google/genai";
import type {
  AIProvider,
  CompletionMessage,
  CompletionOptions,
  CompletionResult,
  EmbeddingResult,
} from "./provider.interface";

const DEFAULT_EMBED_MODEL = "gemini-embedding-001";
const DEFAULT_CHAT_MODEL = "gemini-3.8-flash";

export class GoogleAIProvider implements AIProvider {
  readonly name = "google";

  private readonly client: GoogleGenAI;
  private readonly embedModel: string;
  private readonly chatModel: string;

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_AI_API_KEY environment variable is not set.");
    }
    this.client = new GoogleGenAI({ apiKey });
    this.embedModel = process.env.GOOGLE_EMBED_MODEL ?? DEFAULT_EMBED_MODEL;
    this.chatModel = process.env.GOOGLE_CHAT_MODEL ?? DEFAULT_CHAT_MODEL;
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const result = await this.client.models.embedContent({
      model: this.embedModel,
      contents: text,
    });

    const embedding = result.embeddings?.[0]?.values;
    if (!embedding) {
      throw new Error("Google AI embed returned no embedding values.");
    }

    return { embedding };
  }

  async complete(
    messages: CompletionMessage[],
    options: CompletionOptions = {}
  ): Promise<CompletionResult> {
    // Separate system instruction from conversation turns
    const systemMessage = messages.find((m) => m.role === "system");
    const conversationMessages = messages.filter((m) => m.role !== "system");

    const response = await this.client.models.generateContent({
      model: this.chatModel,
      contents: conversationMessages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      config: {
        systemInstruction: systemMessage?.content,
        maxOutputTokens: options.maxTokens ?? 512,
        temperature: options.temperature ?? 0.2,
      },
    });

    return {
      text: response.text ?? "",
      tokenCount: response.usageMetadata?.totalTokenCount,
    };
  }
}
