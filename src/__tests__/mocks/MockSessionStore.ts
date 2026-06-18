import { Session } from '../../session/Session.js';
import type { SessionId } from '../../types/index.js';
import type { ISessionStore } from '../../session/ISessionStore.js';

/**
 * MockSessionStore — 确定性行为的测试 Session 存储
 */
export class MockSessionStore implements ISessionStore {
  private sessions = new Map<SessionId, Session>();
  public createCount = 0;

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
    this.createCount++;
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

  /** 清空所有数据 */
  reset(): void {
    this.sessions.clear();
    this.createCount = 0;
  }
}
