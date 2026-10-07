/**
 * AIProvider interface
 *
 * Every AI backend (Ollama, Google AI, etc.) must implement this contract.
 * The rest of the application talks only to this interface — never to a
 * concrete provider directly.
 */

export interface EmbeddingResult {
  embedding: number[];
  /** Number of tokens consumed (optional – providers may not expose this) */
  tokenCount?: number;
}

export interface CompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionResult {
  text: string;
  tokenCount?: number;
}

export interface AIProvider {
  /**
   * Name of the provider (used for logging / diagnostics).
   * e.g. "ollama" | "google"
   */
  readonly name: string;

  /**
   * Generate a vector embedding for the given text.
   * The dimension must be consistent across all providers used in a deployment.
   */
  embed(text: string): Promise<EmbeddingResult>;

  /**
   * Generate a chat completion.
   * @param messages  Ordered conversation messages.
   * @param options   Optional generation parameters.
   */
  complete(
    messages: CompletionMessage[],
    options?: CompletionOptions
  ): Promise<CompletionResult>;
}

export interface CompletionOptions {
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Sampling temperature (0 = deterministic, 1 = creative) */
  temperature?: number;
}
