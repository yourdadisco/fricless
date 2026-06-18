import type { StreamResult, Message } from '../types/index.js';
import type { AIProvider, ToolDescriptor, ModelInfo } from './types.js';

export class RetryProvider implements AIProvider {
  readonly name: string;
  readonly vendor: string;
  private inner: AIProvider;
  private maxRetries: number;
  private baseDelay: number;

  constructor(
    inner: AIProvider,
    maxRetries: number = 3,
    baseDelay: number = 1000,
  ) {
    this.inner = inner;
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.name = `retry(${inner.name})`;
    this.vendor = inner.vendor;
  }

  async *stream(messages: Message[], tools: ToolDescriptor[]): StreamResult {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        yield* this.inner.stream(messages, tools);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.maxRetries) {
          const delay = this.baseDelay * Math.pow(2, attempt - 1);
          yield { type: 'text', delta: `\n[重试 ${attempt}/${this.maxRetries - 1}...]\n` };
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    yield { type: 'error', message: `重试 ${this.maxRetries - 1} 次后仍失败: ${lastError?.message}` };
  }

  countTokens(messages: Message[]): number { return this.inner.countTokens(messages); }
  healthCheck(): Promise<boolean> { return this.inner.healthCheck(); }
  getModelInfo(): ModelInfo { return this.inner.getModelInfo(); }
}
