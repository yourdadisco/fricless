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

export interface SearchOptions {
  query: string;
  limit?: number;
  offset?: number;
  category?: string;
  userId?: string;
  sessionId?: string;
  minConfidence?: number;
  tags?: string[];
  dateFrom?: number;
  dateTo?: number;
}

export interface MemoryStats {
  total: number;
  byCategory: Record<string, number>;
  byUser: Record<string, number>;
  avgConfidence: number;
  totalTags: number;
  oldestEntry: number;
  newestEntry: number;
  memoryUsage: number;
}

function loadBetterSqlite3(): any {
  try { return require('better-sqlite3'); } catch { return null; }
}

type SqliteRow = Record<string, unknown>;

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
        category TEXT NOT NULL CHECK(category IN ('fact','preference','summary','event')),
        confidence REAL NOT NULL DEFAULT 0.5 CHECK(confidence BETWEEN 0 AND 1),
        created_at INTEGER NOT NULL,
        last_accessed_at INTEGER NOT NULL,
        access_count INTEGER NOT NULL DEFAULT 0,
        tags TEXT NOT NULL DEFAULT '[]'
      );
      CREATE INDEX IF NOT EXISTS idx_memories_user_cat ON memories(user_id, category);
      CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id);
      CREATE INDEX IF NOT EXISTS idx_memories_confidence ON memories(confidence DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_accessed ON memories(last_accessed_at);
    `);

    try {
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
          content, tags, category,
          content=memories, content_rowid=rowid,
          tokenize='unicode61'
        );
      `);
    } catch {
      // FTS5 unavailable
    }
  }

  // ── Core API ─────────────────────────────────────────

  async save(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>): Promise<string> {
    const now = Date.now();
    const id = randomUUID();

    if (this.db) {
      // Dedup: check for similar existing entry within same session+category
      const existing = this.db.prepare(
        'SELECT id, confidence, access_count FROM memories WHERE session_id = ? AND category = ? ORDER BY confidence DESC LIMIT 3'
      ).all(entry.sessionId, entry.category) as SqliteRow[];

      for (const row of existing) {
        const existingContent = this.db.prepare('SELECT content FROM memories WHERE id = ?').get(row.id) as SqliteRow;
        if (existingContent && similarity(entry.content, existingContent.content as string) > 0.8) {
          // Update existing: boost confidence, add tags
          const newConf = Math.min(1, (row.confidence as number) + entry.confidence * 0.2);
          const existingTags = JSON.parse((this.db.prepare('SELECT tags FROM memories WHERE id = ?').get(row.id) as SqliteRow).tags as string) as string[];
          const mergedTags = [...new Set([...existingTags, ...entry.tags])];
          this.db.prepare(
            'UPDATE memories SET confidence = ?, tags = ?, last_accessed_at = ?, access_count = access_count + 1 WHERE id = ?'
          ).run(newConf, JSON.stringify(mergedTags), now, row.id);
          this.updateFts(row.id as string);
          return row.id as string;
        }
      }

      this.db.prepare(`
        INSERT INTO memories (id, session_id, user_id, content, category, confidence, created_at, last_accessed_at, access_count, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).run(id, entry.sessionId, entry.userId, entry.content.slice(0, 2000), entry.category, entry.confidence, now, now, JSON.stringify(entry.tags));
      this._count++;
      this.updateFts(id);
    } else if (this.fallback) {
      this.fallback.save({ ...entry, id, createdAt: now, lastAccessedAt: now, accessCount: 0 });
      this._count++;
    }
    return id;
  }

  async saveMany(entries: Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>[]): Promise<string[]> {
    return Promise.all(entries.map(e => this.save(e)));
  }

  // ── Rich Search ──────────────────────────────────────

  async search(opts: SearchOptions): Promise<{ entries: MemoryEntry[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (opts.category) { conditions.push('category = ?'); params.push(opts.category); }
    if (opts.userId) { conditions.push('user_id = ?'); params.push(opts.userId); }
    if (opts.sessionId) { conditions.push('session_id = ?'); params.push(opts.sessionId); }
    if (opts.minConfidence !== undefined) { conditions.push('confidence >= ?'); params.push(opts.minConfidence); }
    if (opts.dateFrom) { conditions.push('created_at >= ?'); params.push(opts.dateFrom); }
    if (opts.dateTo) { conditions.push('created_at <= ?'); params.push(opts.dateTo); }
    if (opts.tags && opts.tags.length > 0) {
      const tagConds = opts.tags.map(() => "tags LIKE ?");
      conditions.push(`(${tagConds.join(' OR ')})`);
      opts.tags.forEach(t => params.push(`%"${t}"%`));
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = opts.limit ?? 20;
    const offset = opts.offset ?? 0;

    if (this.db) {
      // FTS5 full-text search
      if (opts.query && this.ftsAvailable()) {
        const ftsResult = this.db.prepare(
          `SELECT rowid FROM memories_fts WHERE memories_fts MATCH ? ORDER BY rank LIMIT ? OFFSET ?`
        ).all(opts.query.replace(/[^\w一-鿿\s-]/g, '').trim() || '""', limit, offset) as SqliteRow[];
        const rowids = ftsResult.map(r => r.rowid);

        if (rowids.length > 0) {
          const total = rowids.length;
          const entries = rowids.map((rowid: unknown) => {
            const row = this.db.prepare('SELECT * FROM memories WHERE rowid = ?').get(rowid) as SqliteRow;
            return row ? this.rowToEntry(row) : null;
          }).filter(Boolean) as MemoryEntry[];
          return { entries, total };
        }
      }

      // LIKE fallback + filters
      if (opts.query) {
        conditions.push('(content LIKE ? OR tags LIKE ?)');
        params.push(`%${opts.query}%`, `%${opts.query}%`);
      }
      const finalWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRow = this.db.prepare(`SELECT COUNT(*) AS c FROM memories ${finalWhere}`).get(...params) as SqliteRow;
      const total = countRow?.c as number ?? 0;

      const rows = this.db.prepare(
        `SELECT * FROM memories ${finalWhere} ORDER BY confidence DESC, created_at DESC LIMIT ? OFFSET ?`
      ).all(...params, limit, offset) as SqliteRow[];

      return { entries: rows.map(r => this.rowToEntry(r)), total };
    }

    // Fallback
    let entries = this.fallback?.getAll() ?? [];
    if (opts.query) entries = entries.filter(e => e.content.includes(opts.query!));
    if (opts.category) entries = entries.filter(e => e.category === opts.category);
    if (opts.userId) entries = entries.filter(e => e.userId === opts.userId);
    entries.sort((a, b) => b.confidence - a.confidence);
    return { entries: entries.slice(offset, offset + limit), total: entries.length };
  }

  // ── Decay: 降低长期未访问记忆的置信度 ──────────────

  async applyDecay(maxAgeDays = 90, decayRate = 0.1): Promise<number> {
    const threshold = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    if (this.db) {
      const result = this.db.prepare(
        'UPDATE memories SET confidence = MAX(0.1, confidence - ?) WHERE last_accessed_at < ? AND confidence > 0.1'
      ).run(decayRate, threshold);
      // Delete completely decayed entries
      this.db.prepare('DELETE FROM memories WHERE confidence < 0.1').run();
      const deleted = this.db.prepare('SELECT changes()').get() as { 'changes()': number };
      return deleted['changes()'] as number;
    }
    return 0;
  }

  // ── Cross-session Links ─────────────────────────────

  async findLinkedMemories(sessionId: string, maxDistance = 3): Promise<MemoryEntry[]> {
    // Find memories from same user across different sessions
    const entry = (await this.search({ query: '', sessionId, limit: 1 })).entries[0];
    if (!entry) return [];
    return (await this.search({
      query: '',
      userId: entry.userId,
      limit: 20,
    })).entries.filter(e => e.sessionId !== sessionId);
  }

  // ── Statistics ───────────────────────────────────────

  async getStats(): Promise<MemoryStats> {
    if (this.db) {
      const total = (this.db.prepare('SELECT COUNT(*) AS c FROM memories').get() as SqliteRow).c as number;
      const byCategory: Record<string, number> = {};
      (this.db.prepare('SELECT category, COUNT(*) AS c FROM memories GROUP BY category').all() as SqliteRow[]).forEach(r => { byCategory[r.category as string] = r.c as number; });
      const byUser: Record<string, number> = {};
      (this.db.prepare('SELECT user_id, COUNT(*) AS c FROM memories GROUP BY user_id').all() as SqliteRow[]).forEach(r => { byUser[r.user_id as string] = r.c as number; });
      const avgConf = (this.db.prepare('SELECT AVG(confidence) AS a FROM memories').get() as SqliteRow).a as number || 0;
      const oldest = (this.db.prepare('SELECT MIN(created_at) AS m FROM memories').get() as SqliteRow).m as number || 0;
      const newest = (this.db.prepare('SELECT MAX(created_at) AS m FROM memories').get() as SqliteRow).m as number || 0;
      return { total, byCategory, byUser, avgConfidence: avgConf, totalTags: 0, oldestEntry: oldest, newestEntry: newest, memoryUsage: 0 };
    }
    return { total: 0, byCategory: {}, byUser: {}, avgConfidence: 0, totalTags: 0, oldestEntry: 0, newestEntry: 0, memoryUsage: 0 };
  }

  // ── Existing API ─────────────────────────────────────

  async getBySession(sessionId: string, limit = 50): Promise<MemoryEntry[]> {
    if (this.db) {
      const rows = this.db.prepare('SELECT * FROM memories WHERE session_id = ? ORDER BY confidence DESC LIMIT ?').all(sessionId, limit) as SqliteRow[];
      return rows.map(r => this.rowToEntry(r));
    }
    return (this.fallback?.getAll() ?? []).filter(e => e.sessionId === sessionId).slice(0, limit);
  }

  async getByUser(userId: string, limit = 50): Promise<MemoryEntry[]> {
    if (this.db) {
      const rows = this.db.prepare('SELECT * FROM memories WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(userId, limit) as SqliteRow[];
      return rows.map(r => this.rowToEntry(r));
    }
    return (this.fallback?.getAll() ?? []).filter(e => e.userId === userId).slice(0, limit);
  }

  async delete(id: string): Promise<boolean> {
    if (this.db) {
      this.db.prepare('DELETE FROM memories WHERE id = ?').run(id);
      try { this.db.prepare('DELETE FROM memories_fts WHERE rowid = (SELECT rowid FROM memories WHERE id = ?)').run(id); } catch {}
      this._count = Math.max(0, this._count - 1);
      return true;
    }
    return this.fallback?.delete(id) ?? false;
  }

  async consolidate(): Promise<number> {
    const entries = this.db
      ? (this.db.prepare('SELECT * FROM memories ORDER BY confidence DESC').all() as SqliteRow[]).map(r => this.rowToEntry(r))
      : this.fallback?.getAll() ?? [];
    let merged = 0;
    const processed = new Set<string>();

    for (let i = 0; i < entries.length; i++) {
      if (processed.has(entries[i].id)) continue;
      for (let j = i + 1; j < entries.length; j++) {
        if (processed.has(entries[j].id)) continue;
        if (entries[i].category !== entries[j].category) continue;
        if (similarity(entries[i].content, entries[j].content) < 0.75) continue;
        const keeper = entries[i].confidence >= entries[j].confidence ? entries[i] : entries[j];
        const removed = entries[i].confidence >= entries[j].confidence ? entries[j] : entries[i];
        keeper.tags = [...new Set([...keeper.tags, ...removed.tags])];
        keeper.confidence = Math.min(1, keeper.confidence + removed.confidence * 0.1);

        if (this.db) {
          this.db.prepare('UPDATE memories SET tags = ?, confidence = ? WHERE id = ?').run(JSON.stringify(keeper.tags), keeper.confidence, keeper.id);
          this.db.prepare('DELETE FROM memories WHERE id = ?').run(removed.id);
        } else {
          this.fallback?.delete(removed.id);
        }
        processed.add(removed.id);
        merged++;
      }
    }

    // Remove old low-confidence entries
    const lowConf = 0.15;
    const threshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
    if (this.db) {
      const old = this.db.prepare('SELECT id FROM memories WHERE confidence < ? AND created_at < ?').all(lowConf, threshold) as SqliteRow[];
      for (const row of old) { await this.delete(row.id as string); merged++; }
    }
    return merged;
  }

  async getAllEntries(): Promise<MemoryEntry[]> {
    if (this.db) {
      return (this.db.prepare('SELECT * FROM memories ORDER BY created_at DESC').all() as SqliteRow[]).map(r => this.rowToEntry(r));
    }
    return this.fallback?.getAll() ?? [];
  }

  get count(): number { return this._count; }

  // ── Helpers ───────────────────────────────────────────

  private ftsAvailable(): boolean {
    if (!this.db) return false;
    try { this.db.prepare('SELECT 1 FROM memories_fts LIMIT 1').get(); return true; } catch { return false; }
  }

  private updateFts(id: string): void {
    try {
      if (!this.ftsAvailable()) return;
      const row = this.db.prepare('SELECT rowid, content, tags, category FROM memories WHERE id = ?').get(id) as SqliteRow;
      if (!row) return;
      this.db.prepare('INSERT OR REPLACE INTO memories_fts (rowid, content, tags, category) VALUES (?, ?, ?, ?)').run(row.rowid, row.content, row.tags, row.category);
    } catch {}
  }

  private rowToEntry(row: SqliteRow): MemoryEntry {
    return {
      id: row.id as string,
      sessionId: row.session_id as string,
      userId: row.user_id as string,
      content: row.content as string,
      category: row.category as MemoryEntry['category'],
      confidence: row.confidence as number,
      createdAt: row.created_at as number,
      lastAccessedAt: row.last_accessed_at as number,
      accessCount: row.access_count as number,
      tags: JSON.parse((row.tags as string) || '[]'),
    };
  }
}

// ── Similarity ──────────────────────────────────────────

function similarity(a: string, b: string): number {
  const aWords = new Set(a.toLowerCase().split(/\s+/));
  const bWords = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...aWords].filter(x => bWords.has(x)));
  const union = new Set([...aWords, ...bWords]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

// ── InMemoryBackend ──────────────────────────────────────

class InMemoryBackend {
  private entries = new Map<string, MemoryEntry>();
  save(e: MemoryEntry): void { this.entries.set(e.id, e); }
  delete(id: string): boolean { return this.entries.delete(id); }
  getAll(): MemoryEntry[] { return [...this.entries.values()]; }
}
