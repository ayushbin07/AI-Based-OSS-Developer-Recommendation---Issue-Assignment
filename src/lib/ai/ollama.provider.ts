/**
 * OllamaProvider
 *
 * Implements AIProvider using a local Ollama instance.
 * Used for development and offline demonstrations.
 *
 * Required env vars:
 *   OLLAMA_BASE_URL   – e.g. http://localhost:11434  (default)
 *   OLLAMA_EMBED_MODEL – e.g. nomic-embed-text        (default)
 *   OLLAMA_CHAT_MODEL  – e.g. llama3.2               (default)
 */

import type {
  AIProvider,
  CompletionMessage,
  CompletionOptions,
  CompletionResult,
  EmbeddingResult,
} from "./provider.interface";

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_EMBED_MODEL = "nomic-embed-text";
const DEFAULT_CHAT_MODEL = "llama3.2";

export class OllamaProvider implements AIProvider {
  readonly name = "ollama";

  private readonly baseUrl: string;
  private readonly embedModel: string;
  private readonly chatModel: string;

  constructor() {
    this.baseUrl =
      process.env.OLLAMA_BASE_URL?.replace(/\/$/, "") ?? DEFAULT_BASE_URL;
    this.embedModel =
      process.env.OLLAMA_EMBED_MODEL ?? DEFAULT_EMBED_MODEL;
    this.chatModel =
      process.env.OLLAMA_CHAT_MODEL ?? DEFAULT_CHAT_MODEL;
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.embedModel, prompt: text }),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama embed failed: ${response.status} ${await response.text()}`
      );
    }

    const data = (await response.json()) as { embedding: number[] };
    return { embedding: data.embedding };
  }

  async complete(
    messages: CompletionMessage[],
    options: CompletionOptions = {}
  ): Promise<CompletionResult> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.chatModel,
        messages,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.2,
          num_predict: options.maxTokens ?? 512,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama chat failed: ${response.status} ${await response.text()}`
      );
    }

    const data = (await response.json()) as {
      message: { content: string };
      eval_count?: number;
    };

    return {
      text: data.message.content,
      tokenCount: data.eval_count,
    };
  }
}
