/**
 * BridgeServer — WebSocket 远程控制桥接服务
 *
 * 允许外部客户端连接 Fricless 实例，接收实时事件并发送控制指令。
 *
 * 协议:
 *   客户端连接后应先发送认证 token（通过 URL 参数或首条消息）。
 *   认证通过后即可接收事件（Event）和发送命令（Command）。
 *
 * 广播事件:
 *   message, response_chunk, tool_call, error, stats
 *
 * 接受命令:
 *   send_message, clear_session, ping
 */

import { WebSocketServer, WebSocket } from 'ws';
import http from 'node:http';
import pino from 'pino';
import type { BridgeEvent, BridgeCommand, CommandResult } from './Protocol.js';

const logger = pino({ name: 'bridge' });

export interface BridgeServerConfig {
  port: number;
  /** 认证 token（留空表示不认证） */
  authToken?: string;
  /** HTTP 服务（可选，用于与 Express 共享端口） */
  server?: http.Server;
}

export class BridgeServer {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();
  private readonly port: number;
  private readonly authToken?: string;

  /** 外部命令处理器（由上层应用注入） */
  onCommand?: (cmd: BridgeCommand, ws: WebSocket) => Promise<CommandResult>;

  constructor(config: BridgeServerConfig) {
    this.port = config.port;
    this.authToken = config.authToken;
  }

  /** 启动 WebSocket 服务 */
  async start(): Promise<void> {
    const options: import('ws').ServerOptions = { port: this.port };

    this.wss = new WebSocketServer(options);

    this.wss.on('connection', (ws, req) => {
      // 从 URL 参数中提取 token
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const token = url.searchParams.get('token');

      // Token 认证
      if (this.authToken && token !== this.authToken) {
        ws.send(JSON.stringify({
          type: 'error',
          payload: { code: 'AUTH_FAILED', message: 'Invalid or missing token', timestamp: new Date().toISOString() },
        } satisfies BridgeEvent));
        ws.close(4001, 'Authentication failed');
        return;
      }

      this.clients.add(ws);
      logger.info({ clientCount: this.clients.size }, 'Bridge 客户端已连接');

      // 发送认证成功事件
      ws.send(JSON.stringify({
        type: 'message',
        payload: {
          sessionId: '',
          userId: 'system',
          role: 'system',
          content: 'Bridge 连接已建立',
          timestamp: new Date().toISOString(),
        },
      } satisfies BridgeEvent));

      // 处理收到的消息
      ws.on('message', async (data) => {
        try {
          const raw = JSON.parse(data.toString()) as Record<string, unknown>;

          // 兼容旧格式：无 type 字段的消息视为 ping
          if (!raw.type) {
            this.sendTo(ws, {
              type: 'error',
              payload: { code: 'INVALID_COMMAND', message: 'Missing type field', timestamp: new Date().toISOString() },
            } satisfies BridgeEvent);
            return;
          }

          const cmd = raw as unknown as BridgeCommand;

          // 如果有外部命令处理器，交由它处理
          if (this.onCommand) {
            const result = await this.onCommand(cmd, ws);
            this.sendTo(ws, result);
          } else {
            // 默认处理
            await this.handleCommand(cmd, ws);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.sendTo(ws, {
            type: 'error',
            payload: { code: 'PARSE_ERROR', message: msg, timestamp: new Date().toISOString() },
          } satisfies BridgeEvent);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        logger.info({ clientCount: this.clients.size }, 'Bridge 客户端已断开');
      });

      ws.on('error', (err) => {
        logger.error({ err }, 'Bridge 客户端连接错误');
        this.clients.delete(ws);
      });
    });

    this.wss.on('error', (err) => {
      logger.error({ err }, 'Bridge WebSocket 服务错误');
    });

    logger.info({ port: this.port }, 'Bridge 服务已启动');
  }

  /** 广播事件到所有已连接客户端 */
  broadcast(event: BridgeEvent): void {
    const msg = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(msg);
        } catch {
          // 单个客户端发送失败不影响其他客户端
        }
      }
    }
  }

  /** 发送消息到指定客户端 */
  private sendTo(ws: WebSocket, data: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(data));
      } catch (err) {
        logger.error({ err }, '发送消息到客户端失败');
      }
    }
  }

  /** 默认命令处理 */
  private async handleCommand(cmd: BridgeCommand, ws: WebSocket): Promise<void> {
    switch (cmd.type) {
      case 'ping': {
        this.sendTo(ws, {
          type: 'command_result',
          success: true,
          data: { timestamp: Date.now() },
        } satisfies CommandResult);
        break;
      }

      case 'send_message': {
        logger.info({ payload: cmd.payload }, 'Bridge 收到 send_message 命令');
        this.sendTo(ws, {
          type: 'command_result',
          success: true,
          data: { message: 'Command received, processing...' },
        } satisfies CommandResult);
        break;
      }

      case 'clear_session': {
        logger.info({ sessionId: cmd.payload.sessionId }, 'Bridge 收到 clear_session 命令');
        this.sendTo(ws, {
          type: 'command_result',
          success: true,
          data: { message: `Session ${cmd.payload.sessionId} cleared` },
        } satisfies CommandResult);
        break;
      }

      default: {
        this.sendTo(ws, {
          type: 'command_result',
          success: false,
          error: `Unknown command type: ${(cmd as Record<string, unknown>).type}`,
        } satisfies CommandResult);
      }
    }
  }

  /** 停止服务 */
  async stop(): Promise<void> {
    for (const client of this.clients) {
      try {
        client.close(1001, 'Server shutting down');
      } catch {
        // ignore
      }
    }
    this.clients.clear();
    this.wss?.close();
    this.wss = null;
    logger.info('Bridge 服务已停止');
  }

  /** 当前客户端数量 */
  get clientCount(): number {
    return this.clients.size;
  }
}
