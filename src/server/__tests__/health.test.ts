/**
 * 健康检查端点测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import express from 'express';
import { createServer, type ServerConfig } from '../index.js';
import { InMemorySessionStore } from '../../session/InMemorySessionStore.js';
import { MetricsCollector } from '../MetricsCollector.js';

/** 辅助：向 server 发起 GET 请求并返回响应 */
function request(
  app: express.Express,
  path: string,
  headers?: Record<string, string> | null,
): Promise<{ status: number; body: unknown }> {
  const defaultHeaders: Record<string, string> = { 'x-api-key': 'test-api-key' };
  const finalHeaders = headers === undefined ? defaultHeaders : headers ?? {};

  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as import('net').AddressInfo;
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: addr.port,
          path,
          method: 'GET',
          headers: finalHeaders,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            server.close();
            const raw = Buffer.concat(chunks).toString('utf-8');
            try {
              resolve({ status: res.statusCode ?? 500, body: JSON.parse(raw) });
            } catch {
              resolve({ status: res.statusCode ?? 500, body: raw });
            }
          });
        },
      );
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      req.setTimeout(3000, () => {
        server.close();
        reject(new Error('Request timeout'));
      });
      req.end();
    });
  });
}

describe('GET /api/health', () => {
  let config: ServerConfig;
  let sessionStore: InMemorySessionStore;
  let metrics: MetricsCollector;

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStore = new InMemorySessionStore();
    metrics = new MetricsCollector();
    config = {
      port: 0,
      apiKey: 'test-api-key',
      sessionStore,
      metrics,
      getChannels: () => [{ name: 'feishu', status: 'connected' }],
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 200 with status ok', async () => {
    const app = createServer(config);
    const { status, body } = await request(app, '/api/health');
    expect(status).toBe(200);
    expect(body).toMatchObject({
      status: 'ok',
      version: '0.1.0-mvp',
      sessions: 0,
      channels: [{ name: 'feishu', status: 'connected' }],
    });
  });

  it('returns uptime as a number', async () => {
    const app = createServer(config);
    const { body } = await request(app, '/api/health');
    expect(body).toHaveProperty('uptime');
    expect(typeof (body as Record<string, unknown>).uptime).toBe('number');
  });

  it('reports active sessions', async () => {
    metrics.setActiveSessions(3);
    const app = createServer(config);
    const { body } = await request(app, '/api/health');
    expect(body).toMatchObject({ sessions: 3 });
  });

  it('rejects requests without API key', async () => {
    const app = createServer(config);
    const { status, body } = await request(app, '/api/health', null);
    expect(status).toBe(401);
    expect(body).toMatchObject({ error: 'Unauthorized' });
  });

  it('rejects requests with wrong API key', async () => {
    const app = createServer(config);
    const { status, body } = await request(app, '/api/health', {
      'x-api-key': 'wrong-key',
    });
    expect(status).toBe(401);
    expect(body).toMatchObject({ error: 'Unauthorized' });
  });

  it('reports multiple channels', async () => {
    config.getChannels = () => [
      { name: 'feishu', status: 'connected' },
      { name: 'discord', status: 'disconnected' },
    ];
    const app = createServer(config);
    const { body } = await request(app, '/api/health');
    expect(body).toMatchObject({
      channels: [
        { name: 'feishu', status: 'connected' },
        { name: 'discord', status: 'disconnected' },
      ],
    });
  });
});

describe('GET /api/stats', () => {
  let config: ServerConfig;
  let metrics: MetricsCollector;

  beforeEach(() => {
    vi.useFakeTimers();
    metrics = new MetricsCollector();
    config = {
      port: 0,
      apiKey: 'test-api-key',
      sessionStore: new InMemorySessionStore(),
      metrics,
      getChannels: () => [],
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns snapshot metrics', async () => {
    metrics.recordMessage('feishu', 150);
    metrics.recordError('api_error');
    metrics.recordTokenUsage('claude-sonnet-4-6', 100, 50);
    metrics.setActiveSessions(2);

    const app = createServer(config);
    const { status, body } = await request(app, '/api/stats');
    expect(status).toBe(200);
    expect(body).toMatchObject({
      messagesTotal: 1,
      errorsTotal: 1,
      activeSessions: 2,
    });
    expect(body).toHaveProperty('tokenUsage');
    expect(body).toHaveProperty('uptime');
    expect(body).toHaveProperty('timestamp');
  });
});

describe('GET /api/sessions', () => {
  let config: ServerConfig;
  let sessionStore: InMemorySessionStore;

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStore = new InMemorySessionStore();
    config = {
      port: 0,
      apiKey: 'test-api-key',
      sessionStore,
      metrics: new MetricsCollector(),
      getChannels: () => [],
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty sessions list', async () => {
    const app = createServer(config);
    const { body } = await request(app, '/api/sessions');
    expect(body).toMatchObject({ sessions: [] });
  });

  it('returns sessions with message count', async () => {
    const session = sessionStore.getOrCreate({
      id: 'sess-1',
      userId: 'user-1',
      chatId: 'chat-1',
    });
    session.addMessage({ role: 'user', content: 'Hello' });
    session.addMessage({ role: 'assistant', content: 'Hi' });

    const app = createServer(config);
    const { body } = await request(app, '/api/sessions');
    expect(body).toMatchObject({
      sessions: [
        {
          id: 'sess-1',
          userId: 'user-1',
          chatId: 'chat-1',
          messageCount: 2,
        },
      ],
    });
  });
});
