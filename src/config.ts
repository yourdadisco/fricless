import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

/** 应用配置 */
export interface AppConfig {
  /** 飞书 App ID（网关模式必填，终端模式可选） */
  feishuAppId?: string;
  /** 飞书 App Secret（网关模式必填，终端模式可选） */
  feishuAppSecret?: string;
  /** Anthropic API Key（可选，终端模式下可用其他提供商） */
  anthropicApiKey?: string;
  /** Claude 模型名称 */
  anthropicModel: string;
  /** Anthropic API Base URL（可选，用于代理） */
  anthropicBaseUrl?: string;
  /** 最大 Token 数（含上下文） */
  maxTokens: number;
  /** 日志级别 */
  logLevel: string;
  /** Gateway WebSocket 监听端口 */
  gatewayPort: number;

  // Phase 2: Web search
  /** SerpAPI API Key（可选，用于网页搜索） */
  serpapiApiKey?: string;

  // Phase 3: Persistence
  /** 会话存储类型 */
  sessionStore: 'memory' | 'sqlite';
  /** SQLite 数据库路径 */
  sqlitePath: string;

  // Phase 3: Rate limiting
  /** 每分钟请求数限制 */
  rateLimitRpm: number;
  /** 突发请求数限制 */
  rateLimitBurst: number;

  // Phase 3: Context management
  /** 最大上下文 Token 数 */
  maxContextTokens: number;

  // Phase 5: Server
  /** 是否启用 Web 管理面板 */
  webPanelEnabled: boolean;
  /** Web 管理面板端口 */
  webPanelPort: number;
  /** 是否启用 Bridge 服务 */
  bridgeEnabled: boolean;
  /** Bridge 服务端口 */
  bridgePort: number;
}

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

let _config: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (_config) return _config;

  _config = {
    feishuAppId: process.env.FEISHU_APP_ID,
    feishuAppSecret: process.env.FEISHU_APP_SECRET,
    anthropicApiKey: optional('ANTHROPIC_API_KEY', ''),
    anthropicModel: optional('ANTHROPIC_MODEL', 'claude-sonnet-4-6'),
    anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL || undefined,
    maxTokens: Number(optional('MAX_TOKENS', '4096')),
    logLevel: optional('LOG_LEVEL', 'info'),
    gatewayPort: Number(optional('GATEWAY_PORT', '18789')),

    // Phase 2
    serpapiApiKey: process.env.SERPAPI_API_KEY || undefined,

    // Phase 3: Persistence
    sessionStore: (process.env.SESSION_STORE === 'sqlite' ? 'sqlite' : 'memory') as 'memory' | 'sqlite',
    sqlitePath: optional('SQLITE_PATH', path.resolve(process.cwd(), 'data', 'sessions.db')),

    // Phase 3: Rate limiting
    rateLimitRpm: Number(optional('RATE_LIMIT_RPM', '30')),
    rateLimitBurst: Number(optional('RATE_LIMIT_BURST', '10')),

    // Phase 3: Context management
    maxContextTokens: Number(optional('MAX_CONTEXT_TOKENS', '64000')),

    // Phase 5: Server
    webPanelEnabled: optional('WEB_PANEL_ENABLED', 'false') === 'true',
    webPanelPort: Number(optional('WEB_PANEL_PORT', '18790')),
    bridgeEnabled: optional('BRIDGE_ENABLED', 'false') === 'true',
    bridgePort: Number(optional('BRIDGE_PORT', '18791')),
  };

  return _config;
}
