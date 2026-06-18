import { randomUUID } from 'node:crypto';

export interface MemoryEntry {
  id: string;
  sessionId: string;
  userId: string;
  content: string;
  category: 'fact' | 'preference' | 'summary' | 'event';
  confidence: number;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  tags: string[];
}

export interface MemoryStoreOptions {
  dbPath?: string;
}

// ---------------------------------------------------------------------------
// Lazy-load better-sqlite3 – it may not be installed or may fail to load
// ---------------------------------------------------------------------------

function loadBetterSqlite3(): typeof import('better-sqlite3') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('better-sqlite3');
  } catch {
    return null;
  }
}

/**
 * SQLite-backed memory store with FTS5 full-text search.
 * Falls back to an in-memory store when better-sqlite3 is unavailable.
 */
export class MemoryStore {
  private db: any | null = null;
  private fallback: InMemoryBackend | null = null;
  private _count = 0;

  constructor(opts?: MemoryStoreOptions) {
    const betterSqlite3 = loadBetterSqlite3();
    if (betterSqlite3) {
      const instance = new betterSqlite3(opts?.dbPath ?? ':memory:');
      instance.pragma('journal_mode = WAL');
      instance.pragma('synchronous = NORMAL');
      this.initSchema(instance);
      this.db = instance;
      this._count = (instance.prepare('SELECT COUNT(*) AS c FROM memories').get() as { c: number }).c;
    } else {
      this.fallback = new InMemoryBackend();
      this._count = 0;
    }
  }

  private initSchema(db: any): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0.5,
        created_at INTEGER NOT NULL,
        last_accessed_at INTEGER NOT NULL,
        access_count INTEGER NOT NULL DEFAULT 0,
        tags TEXT NOT NULL DEFAULT '[]'
      );
      CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);
      CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id);
    `);

    // FTS5 virtual table — ignore if FTS5 is not available
    try {
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
          content, tags, content=memories, content_rowid=rowid
        );
      `);
    } catch {
      // FTS5 may not be available in all SQLite builds; search falls back to LIKE
    }
  }

  // ---------------------------------------------------------------------------
  // Core API
  // ---------------------------------------------------------------------------

  async save(
    entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>,
  ): Promise<string> {
    const now = Date.now();
    const id = randomUUID();

    if (this.db) {
      this.db.prepare(`
        INSERT INTO memories (id, session_id, user_id, content, category, confidence, created_at, last_accessed_at, access_count, tags)
        VALUES (@id, @sessionId, @userId, @content, @category, @confidence, @createdAt, @lastAccessedAt, @accessCount, @tags)
      `).run({
        id,
        sessionId: entry.sessionId,
        userId: entry.userId,
        content: entry.content,
        category: entry.category,
        confidence: entry.confidence,
        createdAt: now,
        lastAccessedAt: now,
        accessCount: 0,
        tags: JSON.stringify(entry.tags),
      });

      this.syncFtsInsert({ ...entry, id, createdAt: now, lastAccessedAt: now, accessCount: 0 });
    } else if (this.fallback) {
      this.fallback.save({
        id,
        ...entry,
        createdAt: now,
        lastAccessedAt: now,
        accessCount: 0,
      });
    }

    this._count++;
    return id;
  }

  async saveMany(
    entries: Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>[],
  ): Promise<string[]> {
    const ids: string[] = [];
    for (const e of entries) {
      ids.push(await this.save(e));
    }
    return ids;
  }

  async search(query: string, limit = 20): Promise<MemoryEntry[]> {
    if (this.db) {
      // Prefer FTS5 search
      const hasFts = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='virtual_table' AND name='memories_fts'",
      ).get();

      if (hasFts) {
        // Sanitize FTS5 query: escape special chars and fold into a prefix query
        const sanitized = query.replace(/[^\w一-鿿\s]/g, '').trim();
        if (!sanitized) return [];

        // Break into terms, each term becomes a prefix match
        const terms = sanitized.split(/\s+/).filter(Boolean).map(t => `"${t}"*`);
        const ftsQuery = terms.join(' AND ');

        try {
          const rows = this.db.prepare(`
            SELECT m.id, m.session_id, m.user_id, m.content, m.category,
                   m.confidence, m.created_at, m.last_accessed_at, m.access_count, m.tags
            FROM memories_fts f
            JOIN memories m ON m.rowid = f.rowid
            WHERE memories_fts MATCH @query
            ORDER BY rank
            LIMIT @limit
          `).all({ query: ftsQuery, limit }) as SqliteRow[];

          return rows.map(r => this.rowToEntry(r));
        } catch {
          // FTS search failed — fall through to LIKE
        }
      }

      // Fallback: LIKE search on content and tags
      const pattern = `%${query}%`;
      const rows = this.db.prepare(`
        SELECT * FROM memories
        WHERE content LIKE @p1 OR tags LIKE @p2
        ORDER BY last_accessed_at DESC
        LIMIT @limit
      `).all({ p1: pattern, p2: pattern, limit }) as SqliteRow[];

      return rows.map(r => this.rowToEntry(r));
    }

    if (this.fallback) {
      return this.fallback.search(query, limit);
    }

    return [];
  }

  async getBySession(sessionId: string, limit = 50): Promise<MemoryEntry[]> {
    if (this.db) {
      const rows = this.db.prepare(`
        SELECT * FROM memories
        WHERE session_id = @sessionId
        ORDER BY created_at DESC
        LIMIT @limit
      `).all({ sessionId, limit }) as SqliteRow[];
      return rows.map(r => this.rowToEntry(r));
    }

    if (this.fallback) {
      return this.fallback.getBySession(sessionId, limit);
    }

    return [];
  }

  async getByUser(userId: string, limit = 50): Promise<MemoryEntry[]> {
    if (this.db) {
      const rows = this.db.prepare(`
        SELECT * FROM memories
        WHERE user_id = @userId
        ORDER BY last_accessed_at DESC
        LIMIT @limit
      `).all({ userId, limit }) as SqliteRow[];
      return rows.map(r => this.rowToEntry(r));
    }

    if (this.fallback) {
      return this.fallback.getByUser(userId, limit);
    }

    return [];
  }

  async delete(id: string): Promise<boolean> {
    if (this.db) {
      const result = this.db.prepare('DELETE FROM memories WHERE id = @id').run({ id });
      if (result.changes > 0) {
        this.syncFtsDelete(id);
        this._count--;
        return true;
      }
      return false;
    }

    if (this.fallback) {
      const ok = this.fallback.delete(id);
      if (ok) this._count--;
      return ok;
    }

    return false;
  }

  /**
   * Consolidate (auto-dream): merge similar entries within the same category
   * and remove low-confidence old entries.
   */
  async consolidate(): Promise<number> {
    const entries = this.db
      ? (this.db.prepare('SELECT * FROM memories ORDER BY confidence DESC').all() as SqliteRow[]).map(r => this.rowToEntry(r))
      : this.fallback?.getAll() ?? [];

    let merged = 0;

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];

        if (a.category !== b.category) continue;
        if (a.userId !== b.userId) continue;

        const similarity = this.calcSimilarity(a.content, b.content);
        if (similarity > 0.75) {
          // Merge: keep the one with higher confidence, combine tags
          const keeper = a.confidence >= b.confidence ? a : b;
          const removed = a.confidence >= b.confidence ? b : a;

          keeper.tags = [...new Set([...keeper.tags, ...removed.tags])];
          keeper.confidence = Math.min(1, keeper.confidence + removed.confidence * 0.1);
          keeper.accessCount += removed.accessCount;

          if (this.db) {
            this.db.prepare(`
              UPDATE memories SET tags = @tags, confidence = @confidence, access_count = @accessCount
              WHERE id = @id
            `).run({
              id: keeper.id,
              tags: JSON.stringify(keeper.tags),
              confidence: keeper.confidence,
              accessCount: keeper.accessCount,
            });

            this.db.prepare('DELETE FROM memories WHERE id = @id').run({ id: removed.id });
            this.syncFtsDelete(removed.id);
          } else if (this.fallback) {
            this.fallback.update(keeper);
            this.fallback.delete(removed.id);
          }

          this._count--;
          merged++;

          // Rebuild entries list after mutation and restart
          return merged + await this.consolidate();
        }
      }
    }

    // Remove low-confidence old entries (7+ days old, confidence < 0.15)
    const threshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const lowConf = 0.15;

    if (this.db) {
      const old: SqliteRow[] = this.db.prepare(`
        SELECT id FROM memories WHERE confidence < @conf AND created_at < @threshold
      `).all({ conf: lowConf, threshold }) as SqliteRow[];

      for (const row of old) {
        await this.delete(row.id);
        merged++;
      }
    } else if (this.fallback) {
      const all = this.fallback.getAll();
      const toRemove = all.filter(e => e.confidence < lowConf && e.createdAt < threshold);
      for (const e of toRemove) {
        this.fallback.delete(e.id);
        this._count--;
        merged++;
      }
    }

    return merged;
  }

  get count(): number {
    return this._count;
  }

  // ---------------------------------------------------------------------------
  // FTS sync helpers
  // ---------------------------------------------------------------------------

  private syncFtsInsert(entry: MemoryEntry): void {
    if (!this.db) return;
    try {
      this.db.prepare(`
        INSERT INTO memories_fts (rowid, content, tags)
        VALUES ((SELECT rowid FROM memories WHERE id = @id), @content, @tags)
      `).run({ id: entry.id, content: entry.content, tags: JSON.stringify(entry.tags) });
    } catch {
      // FTS table may not exist
    }
  }

  private syncFtsDelete(id: string): void {
    if (!this.db) return;
    try {
      this.db.prepare('DELETE FROM memories_fts WHERE rowid = (SELECT rowid FROM memories WHERE id = @id)').run({ id });
    } catch {
      // FTS table may not exist
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private rowToEntry(row: SqliteRow): MemoryEntry {
    return {
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      content: row.content,
      category: row.category as MemoryEntry['category'],
      confidence: row.confidence,
      createdAt: row.created_at,
      lastAccessedAt: row.last_accessed_at,
      accessCount: row.access_count,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags as string[],
    };
  }

  /**
   * Simple Jaccard-like similarity on word overlap.
   */
  private calcSimilarity(a: string, b: string): number {
    const tokensA = new Set(a.split(/\s+/));
    const tokensB = new Set(b.split(/\s+/));
    if (tokensA.size === 0 && tokensB.size === 0) return 1;

    let intersection = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) intersection++;
    }

    const union = new Set([...tokensA, ...tokensB]);
    return intersection / union.size;
  }
}

// ---------------------------------------------------------------------------
// SQLite row shape
// ---------------------------------------------------------------------------

interface SqliteRow {
  id: string;
  session_id: string;
  user_id: string;
  content: string;
  category: string;
  confidence: number;
  created_at: number;
  last_accessed_at: number;
  access_count: number;
  tags: string;
}

// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------

class InMemoryBackend {
  private entries = new Map<string, MemoryEntry>();

  save(entry: MemoryEntry): void {
    this.entries.set(entry.id, entry);
  }

  search(query: string, limit: number): MemoryEntry[] {
    const q = query.toLowerCase();
    return [...this.entries.values()]
      .filter(e =>
        e.content.toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)
      .slice(0, limit);
  }

  getBySession(sessionId: string, limit: number): MemoryEntry[] {
    return [...this.entries.values()]
      .filter(e => e.sessionId === sessionId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  getByUser(userId: string, limit: number): MemoryEntry[] {
    return [...this.entries.values()]
      .filter(e => e.userId === userId)
      .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)
      .slice(0, limit);
  }

  delete(id: string): boolean {
    return this.entries.delete(id);
  }

  update(entry: MemoryEntry): void {
    this.entries.set(entry.id, entry);
  }

  getAll(): MemoryEntry[] {
    return [...this.entries.values()];
  }
}
