import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Session } from '../Session.js';

describe('Session', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('constructor sets id, userId, chatId, and systemPrompt', () => {
    const session = new Session({
      id: 'session-1',
      userId: 'user-abc',
      chatId: 'chat-xyz',
      systemPrompt: 'Custom prompt',
    });

    expect(session.id).toBe('session-1');
    expect(session.userId).toBe('user-abc');
    expect(session.chatId).toBe('chat-xyz');
    expect(session.systemPrompt).toBe('Custom prompt');
  });

  it('constructor sets default systemPrompt when not provided', () => {
    const session = new Session({ id: 'session-2', userId: 'user-def' });
    expect(session.systemPrompt).toBe('你是一个智能助手，请用中文回答用户的问题。');
  });

  it('constructor initializes createdAt and lastActiveAt', () => {
    const session = new Session({ id: 'session-3', userId: 'user-ghi' });
    expect(session.createdAt).toBeInstanceOf(Date);
    expect(session.lastActiveAt).toBeInstanceOf(Date);
    expect(session.lastActiveAt.getTime()).toBe(session.createdAt.getTime());
  });

  it('constructor initializes empty messages', () => {
    const session = new Session({ id: 'session-4', userId: 'user-jkl' });
    expect(session.messages).toEqual([]);
  });

  it('addMessage appends to messages and updates lastActiveAt', () => {
    const session = new Session({ id: 'session-5', userId: 'user-mno' });
    const createdAt = session.lastActiveAt.getTime();

    vi.advanceTimersByTime(5000);
    session.addMessage({ role: 'user', content: 'Hello' });

    expect(session.messages).toHaveLength(1);
    expect(session.messages[0]).toEqual({ role: 'user', content: 'Hello' });
    expect(session.lastActiveAt.getTime()).toBeGreaterThan(createdAt);
  });

  it('addMessage appends multiple messages in order', () => {
    const session = new Session({ id: 'session-6', userId: 'user-pqr' });

    session.addMessage({ role: 'user', content: 'Hi' });
    session.addMessage({ role: 'assistant', content: 'Hello!' });

    expect(session.messages).toHaveLength(2);
    expect(session.messages[0].role).toBe('user');
    expect(session.messages[1].role).toBe('assistant');
  });

  it('clearMessages empties messages and updates lastActiveAt', () => {
    const session = new Session({ id: 'session-7', userId: 'user-stu' });
    session.addMessage({ role: 'user', content: 'Hello' });
    session.addMessage({ role: 'assistant', content: 'Hi' });
    expect(session.messages).toHaveLength(2);

    const beforeClear = session.lastActiveAt.getTime();
    vi.advanceTimersByTime(2000);
    session.clearMessages();

    expect(session.messages).toHaveLength(0);
    expect(session.lastActiveAt.getTime()).toBeGreaterThan(beforeClear);
  });

  it('isExpired returns true after 1 hour idle', () => {
    const session = new Session({ id: 'session-8', userId: 'user-vwx' });

    expect(session.isExpired()).toBe(false);

    vi.advanceTimersByTime(61 * 60 * 1000); // 61 minutes

    expect(session.isExpired()).toBe(true);
  });

  it('isExpired returns false before 1 hour idle', () => {
    const session = new Session({ id: 'session-9', userId: 'user-yza' });

    vi.advanceTimersByTime(30 * 60 * 1000); // 30 minutes

    expect(session.isExpired()).toBe(false);
  });

  it('isExpired returns false after touch', () => {
    const session = new Session({ id: 'session-10', userId: 'user-bcd' });

    vi.advanceTimersByTime(59 * 60 * 1000); // 59 minutes
    session.touch();

    expect(session.isExpired()).toBe(false);

    vi.advanceTimersByTime(30 * 1000); // 30 seconds more
    expect(session.isExpired()).toBe(false);
  });

  it('touch() updates lastActiveAt', () => {
    const session = new Session({ id: 'session-11', userId: 'user-efg' });
    const before = session.lastActiveAt.getTime();

    vi.advanceTimersByTime(100);
    session.touch();

    expect(session.lastActiveAt.getTime()).toBe(before + 100);
  });

  it('getContextMessages returns system prompt followed by recent messages', () => {
    const session = new Session({
      id: 'session-12',
      userId: 'user-hij',
      systemPrompt: 'Test system prompt',
    });

    session.addMessage({ role: 'user', content: 'Q1' });
    session.addMessage({ role: 'assistant', content: 'A1' });

    const ctx = session.getContextMessages();

    expect(ctx).toHaveLength(3);
    expect(ctx[0]).toEqual({ role: 'system', content: 'Test system prompt' });
    expect(ctx[1]).toEqual({ role: 'user', content: 'Q1' });
    expect(ctx[2]).toEqual({ role: 'assistant', content: 'A1' });
  });

  it('getContextMessages limits to 50 recent messages', () => {
    const session = new Session({ id: 'session-13', userId: 'user-klm' });

    for (let i = 0; i < 55; i++) {
      session.addMessage({ role: 'user', content: `msg-${i}` });
    }

    const ctx = session.getContextMessages();
    // 1 system + 50 recent = 51
    expect(ctx).toHaveLength(51);
    // The oldest user message in context should be msg-5 (since 50 from the end of 55)
    expect(ctx[1].content).toBe('msg-5');
  });
});
