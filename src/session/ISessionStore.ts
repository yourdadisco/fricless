import { Session } from './Session.js';
import type { SessionId } from '../types/index.js';

/** Session 存储接口 */
export interface ISessionStore {
  getOrCreate(params: {
    id: SessionId;
    userId: string;
    chatId?: string;
    systemPrompt?: string;
  }): Session;

  get(id: SessionId): Session | null;
  delete(id: SessionId): boolean;
  cleanExpired(): number;
  readonly activeCount: number;
  getAll(): Session[];
}
