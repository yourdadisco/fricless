import type { Channel, InboundMessage, MessageHandler, ChannelStatus } from '../../channels/types.js';

/**
 * MockChannel — 捕获发送调用以进行断言的测试通道
 */
export class MockChannel implements Channel {
  readonly name = 'mock-channel';
  private _status: ChannelStatus = 'connected';
  private _onMessage: MessageHandler | null = null;
  public sentMessages: Array<{ chatId: string; content: string }> = [];
  public streamedMessages: Array<{ chatId: string; chunks: string[] }> = [];
  public streamResults: string[] = [];

  get status(): ChannelStatus {
    return this._status;
  }

  setStatus(s: ChannelStatus): void {
    this._status = s;
  }

  onMessage(handler: MessageHandler): void {
    this._onMessage = handler;
  }

  /** 模拟收到一条消息 */
  async simulateMessage(msg: InboundMessage): Promise<void> {
    if (this._onMessage) {
      await this._onMessage(msg);
    }
  }

  async connect(): Promise<void> {
    this._status = 'connected';
  }

  async disconnect(): Promise<void> {
    this._status = 'disconnected';
  }

  async send(chatId: string, content: string): Promise<void> {
    this.sentMessages.push({ chatId, content });
  }

  async sendStream(
    chatId: string,
    produce: (append: (chunk: string) => Promise<void>) => Promise<void>,
  ): Promise<string> {
    const chunks: string[] = [];
    const result = await produce(async (chunk) => {
      chunks.push(chunk);
    });
    this.streamedMessages.push({ chatId, chunks });
    const finalContent = chunks.join('');
    this.streamResults.push(finalContent);
    return finalContent;
  }

  /** 清空所有捕获的数据 */
  reset(): void {
    this.sentMessages = [];
    this.streamedMessages = [];
    this.streamResults = [];
  }
}
