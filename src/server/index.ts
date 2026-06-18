/**
 * Server — Web 管理面板 API 服务（Express）
 *
 * 提供:
 *   GET /api/health    → 服务健康检查
 *   GET /api/sessions  → 活跃 Session 列表
 *   GET /api/stats     → 用量统计
 *
 * 所有 API 端点受 API Key 认证保护。
 */

import express from 'express';
import pino from 'pino';
import type { ISessionStore } from '../session/ISessionStore.js';
import { MetricsCollector } from './MetricsCollector.js';

const logger = pino({ name: 'server' });

export interface ServerConfig {
  port: number;
  apiKey: string;
  sessionStore: ISessionStore;
  metrics: MetricsCollector;
  getChannels: () => { name: string; status: string }[];
}

export function createServer(config: ServerConfig) {
  const app = express();
  app.use(express.json());

  // ── Auth middleware ───────────────────────────────────────
  app.use('/api', (req, res, next) => {
    const key = req.headers['x-api-key'] as string | undefined;
    if (key !== config.apiKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  });

  // ── GET /api/health ───────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    const snapshot = config.metrics.snapshot();
    res.json({
      status: 'ok',
      uptime: snapshot.uptime,
      version: '0.1.0-mvp',
      sessions: snapshot.activeSessions,
      channels: config.getChannels(),
    });
  });

  // ── GET /api/stats ────────────────────────────────────────
  app.get('/api/stats', (_req, res) => {
    const snapshot = config.metrics.snapshot();
    res.json(snapshot);
  });

  // ── GET /api/sessions ─────────────────────────────────────
  app.get('/api/sessions', (_req, res) => {
    const sessions = config.sessionStore.getAll().map((s) => ({
      id: s.id,
      userId: s.userId,
      chatId: s.chatId ?? null,
      messageCount: s.messages.length,
      lastActiveAt: s.lastActiveAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
    }));
    res.json({ sessions });
  });

  return app;
}

export async function startServer(config: ServerConfig): Promise<void> {
  const app = createServer(config);
  return new Promise<void>((resolve) => {
    app.listen(config.port, () => {
      logger.info({ port: config.port }, 'Web 管理面板已启动');
      resolve();
    });
  });
}
