export type OutputMode = 'terminal' | 'feishu';

export interface Renderer {
  readonly mode: OutputMode;

  /** 渲染纯文本 */
  text(content: string): Promise<void>;

  /** 渲染流式文本块 */
  streamText(chunk: string, done: boolean): Promise<void>;

  /** 渲染 Tool 调用 */
  toolUse(name: string, input: unknown): Promise<void>;

  /** 渲染 Tool 结果 */
  toolResult(name: string, result: string, isError: boolean): Promise<void>;

  /** 渲染错误 */
  error(message: string): Promise<void>;

  /** 渲染 Markdown */
  markdown(content: string): Promise<void>;

  /** 渲染列表 */
  list(items: string[], title?: string): Promise<void>;

  /** 渲染分隔线 */
  divider(): Promise<void>;
}
