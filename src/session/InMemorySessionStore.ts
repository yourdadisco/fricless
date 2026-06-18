import { Session } from './Session.js';
import type { SessionId } from '../types/index.js';
import type { ISessionStore } from './ISessionStore.js';

/**
 * InMemorySessionStore — 内存 Session 存储
 *
 * MVP 阶段默认实现，后续可替换为 SQLite/Redis。
 * 实现 ISessionStore 接口以保证可替换性。
 */
export class InMemorySessionStore implements ISessionStore {
  private sessions = new Map<SessionId, Session>();

  getOrCreate(params: {
    id: SessionId;
    userId: string;
    chatId?: string;
    systemPrompt?: string;
  }): Session {
    const existing = this.sessions.get(params.id);
    if (existing) {
      existing.touch();
      return existing;
    }

    const session = new Session(params);
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: SessionId): Session | null {
    return this.sessions.get(id) ?? null;
  }

  delete(id: SessionId): boolean {
    return this.sessions.delete(id);
  }

  cleanExpired(): number {
    let cleaned = 0;
    for (const [id, session] of this.sessions) {
      if (session.isExpired()) {
        this.sessions.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }

  get activeCount(): number {
    return this.sessions.size;
  }

  getAll(): Session[] {
    return Array.from(this.sessions.values());
  }
}
