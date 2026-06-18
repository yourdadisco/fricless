import type { Renderer, OutputMode } from '../../render/RenderLayer.js';

/**
 * MockRenderer — 捕获渲染调用以进行断言的测试渲染器
 */
export class MockRenderer implements Renderer {
  readonly mode: OutputMode = 'terminal';
  public texts: string[] = [];
  public errors: string[] = [];
  public toolUses: Array<{ name: string; input: unknown }> = [];
  public toolResults: Array<{ name: string; result: string; isError: boolean }> = [];
  public lists: Array<{ items: string[]; title?: string }> = [];
  public markdowns: string[] = [];
  public streamChunks: Array<{ chunk: string; done: boolean }> = [];

  async text(content: string): Promise<void> { this.texts.push(content); }
  async streamText(chunk: string, done: boolean): Promise<void> { this.streamChunks.push({ chunk, done }); }
  async toolUse(name: string, input: unknown): Promise<void> { this.toolUses.push({ name, input }); }
  async toolResult(name: string, result: string, isError: boolean): Promise<void> { this.toolResults.push({ name, result, isError }); }
  async error(message: string): Promise<void> { this.errors.push(message); }
  async markdown(content: string): Promise<void> { this.markdowns.push(content); }
  async list(items: string[], title?: string): Promise<void> { this.lists.push({ items, title }); }
  async divider(): Promise<void> {}

  /** 清空所有捕获的数据 */
  reset(): void {
    this.texts = [];
    this.errors = [];
    this.toolUses = [];
    this.toolResults = [];
    this.lists = [];
    this.markdowns = [];
    this.streamChunks = [];
  }
}
