import Database from 'better-sqlite3';
import path from 'node:path';
import { Session } from './Session.js';
import type { SessionId } from '../types/index.js';
import type { ISessionStore } from './ISessionStore.js';

export class SQLiteSessionStore implements ISessionStore {
  private db: Database.Database;
  private memoryCache = new Map<SessionId, Session>();

  constructor(dbPath?: string) {
    const resolvedPath = dbPath || path.resolve(process.cwd(), 'data', 'sessions.db');
    // Ensure directory exists
    const dir = path.dirname(resolvedPath);
    require('fs').mkdirSync(dir, { recursive: true });

    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initializeSchema();
    this.loadAllIntoCache();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        chat_id TEXT,
        created_at INTEGER NOT NULL,
        last_active_at INTEGER NOT NULL,
        system_prompt TEXT NOT NULL DEFAULT '',
        metadata TEXT
      );
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_call_id TEXT,
        tool_name TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, id);
      CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(last_active_at);
    `);
  }

  private loadAllIntoCache(): void {
    const rows = this.db.prepare('SELECT * FROM sessions').all() as any[];
    for (const row of rows) {
      const session = this.rowToSession(row);
      this.memoryCache.set(session.id, session);

      // Load messages for this session
      const messages = this.db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY id').all(row.id) as any[];
      for (const msg of messages) {
        session.messages.push({
          role: msg.role,
          content: msg.content,
          toolCallId: msg.tool_call_id || undefined,
          toolName: msg.tool_name || undefined,
        });
      }
    }
  }

  private rowToSession(row: any): Session {
    const session = new Session({
      id: row.id,
      userId: row.user_id,
      chatId: row.chat_id || undefined,
      systemPrompt: row.system_prompt,
    });
    // Override timestamps from DB
    (session as any).createdAt = new Date(row.created_at);
    session.lastActiveAt = new Date(row.last_active_at);
    return session;
  }

  getOrCreate(params: { id: SessionId; userId: string; chatId?: string; systemPrompt?: string; }): Session {
    const existing = this.memoryCache.get(params.id);
    if (existing) {
      existing.touch();
      this.persistSessionTouch(params.id);
      return existing;
    }

    const now = Date.now();
    this.db.prepare(`
      INSERT OR IGNORE INTO sessions (id, user_id, chat_id, created_at, last_active_at, system_prompt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(params.id, params.userId, params.chatId || null, now, now, params.systemPrompt || '');

    const session = new Session(params);
    this.memoryCache.set(session.id, session);
    return session;
  }

  private persistSessionTouch(id: SessionId): void {
    this.db.prepare('UPDATE sessions SET last_active_at = ? WHERE id = ?').run(Date.now(), id);
  }

  get(id: SessionId): Session | null {
    return this.memoryCache.get(id) ?? null;
  }

  delete(id: SessionId): boolean {
    this.db.prepare('DELETE FROM messages WHERE session_id = ?').run(id);
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
    return this.memoryCache.delete(id);
  }

  cleanExpired(): number {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const expired = this.db.prepare('SELECT id FROM sessions WHERE last_active_at < ?').all(oneHourAgo) as any[];

    for (const row of expired) {
      this.db.prepare('DELETE FROM messages WHERE session_id = ?').run(row.id);
      this.db.prepare('DELETE FROM sessions WHERE id = ?').run(row.id);
      this.memoryCache.delete(row.id);
    }

    return expired.length;
  }

  get activeCount(): number {
    return this.memoryCache.size;
  }

  getAll(): Session[] {
    return Array.from(this.memoryCache.values());
  }

  close(): void {
    this.db.close();
  }
}
