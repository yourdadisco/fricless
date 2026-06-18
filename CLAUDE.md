# Fricless — 类 OpenClaw 网关 × Claude Harness 架构

> **定位**: 一个具有 OpenClaw 网关体验、但对话 Harness 架构遵循 Claude Code 设计理念的飞书机器人网关。
> **状态**: P2-P5 全部完成（P1 MVP → P5 全平台），60 个测试通过。

---

## 总体架构

```
┌─────────────────────────────────────────────────────────┐
│                     Gateway                              │
│  (控制平面 — 消息路由、Session 管理、通道调度、限流)     │
│                                                          │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌────────┐  │
│  │ Channel  │  │  Router   │  │ Rate-    │  │ Config │  │
│  │ Adapter  │──│ (Msg →    │──│ Limiter  │──│ (env)  │  │
│  │ (Feishu) │  │  Session) │  │ (Token   │  │        │  │
│  └─────┬────┘  └─────┬─────┘  │  Bucket) │  └────────┘  │
│        │             │        └──────────┘               │
│        ▼             ▼                                   │
│  ┌────────────────────────────────────────────────────┐  │
│  │                  Harness                            │  │
│  │  (对话循环 — 用户 ↔ AI ↔ Tools 核心引擎)            │  │
│  │                                                     │  │
│  │  ┌───────────┐  ┌───────────┐  ┌────────────────┐  │  │
│  │  │  Tools    │  │ Commands  │  │   Provider     │  │  │
│  │  │(LLM可调)  │  │ (/slash)  │  │  (多模型抽象)  │  │  │
│  │  └───────────┘  └───────────┘  └───────┬────────┘  │  │
│  │         ┌────────────────┐  ┌──────────┴────────┐  │  │
│  │         │  TokenCounter  │  │  TokenBudget      │  │  │
│  │         │  (估算/修剪)   │  │  (上下文窗口)     │  │  │
│  │         └────────────────┘  └───────────────────┘  │  │
│  │         ┌────────────────────────────────────────┐  │  │
│  │         │  RenderLayer                           │  │  │
│  │         │  (TerminalRenderer / FeishuRenderer)   │  │  │
│  │         └────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │  Session Store   │  │  Coordinator     │             │
│  │ (内存 / SQLite)  │  │ (多 Agent 编排)  │             │
│  └──────────────────┘  └──────────────────┘             │
│                                                          │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │  Bridge Server   │  │  Web Panel       │             │
│  │ (WS 远程控制)    │  │ (Express + API)  │             │
│  └──────────────────┘  └──────────────────┘             │
│                                                          │
│  ┌──────────────────┐                                    │
│  │  Plugin System   │  (EventBus + 生命周期)            │
│  └──────────────────┘                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 架构决策记录 (ADR)

### ADR-001: 采用 Claude Code 的 Tool 接口模式

**Decision**: 采用 `defineTool()` / `defineToolWithSchema()` 构建器模式（类比 Claude Code 的 `buildTool`）。使用 `zod-to-json-schema` 包将 Zod Schema 自动转为 JSON Schema 传递给 AI Provider。

### ADR-002: Gateway 作为唯一控制平面

**Decision**: OpenClaw 风格的 Gateway 管理通道生命周期 + 消息路由。Harness 保持通道无关。

### ADR-003: Provider 抽象层 + 装饰器模式

**Decision**: `AIProvider` 接口包含 `stream()`、`countTokens()`、`healthCheck()`、`getModelInfo()`。`FallbackProvider` 和 `RetryProvider` 使用装饰器模式包装基础 Provider，实现重试和故障切换。

### ADR-004: Session 隔离 + ISessionStore

**Decision**: 每个 Session 独立 Harness。提取 `ISessionStore` 接口，支持 `InMemorySessionStore` 和 `SQLiteSessionStore` 两种实现。`SQLiteSessionStore` 使用 WAL 模式 + 内存缓存。

### ADR-005: 流式输出 — 按文本段独立流

**Decision**: 每个 AI 文本段发起一次 `sendStream`。Tool Use 发生时关闭当前流，Tool 结果返回后新文本段开启新流。利用飞书 SDK 内置的 typewriter 动画效果。

### ADR-006: Token 预算上下文修剪

**Decision**: 使用 `TokenCounter` 基于字符比例的 token 估算。从最新消息反向遍历填满 Token 预算，替代硬编码的 50 条消息限制。

### ADR-007: 速率限制 — Token Bucket 三层

**Decision**: 全局/用户/会话三层 Token Bucket。`RateLimitConfig` 配置 `requestsPerMinute` + `burstSize`。

### ADR-008: Coordinator 分层编排

**Decision**: Coordinator + SubAgent 模式。每个 Agent 持有自己的 Harness、Provider、Tools、Session。主 Agent 处理对话，可注册子 Agent 处理特定任务。

### ADR-009: 插件系统 — EventBus + 钩子

**Decision**: `FriclessPlugin` 接口：`initialize/destroy/registerTools/registerCommands/onBeforeMessage/onAfterResponse`。`EventBus` 用于插件间通信。`PluginManager` 从目录动态加载。

### ADR-010: Bridge 远程控制协议

**Decision**: 基于 JSON 的原生 WebSocket 协议。`BridgeEvent`（服务端→客户端：消息/响应块/Tool 调用/错误/统计）和 `BridgeCommand`（客户端→服务端：发送消息/审批 Tool/清理会话/Ping）。

### ADR-011: RenderLayer 双模渲染

**Decision**: 抽象 `Renderer` 接口，`TerminalRenderer` + `FeishuRenderer` 两种实现。Harness 将 AI 输出流交由 RenderLayer 渲染，不直接操作 Channel。每个 Renderer 实现 `renderMessage()`、`renderStream()`、`renderToolCall()`。

**Rationale**: 终端和飞书共享同一套 Harness，渲染层解耦使 Harness 保持通道无关，Renderer 各自处理格式差异（终端 ANSI / 飞书 Markdown）。

### ADR-012: 并行 Tool 执行

**Decision**: `ToolDef` 新增 `isConcurrencySafe: boolean` 标记。Harness 在收到多个 Tool Use 请求时，将 `isConcurrencySafe === true` 的 Tool 用 `Promise.all` 分组并行执行，非安全 Tool 保持串行。

**Rationale**: 参考 Claude Code 的 `isConcurrencySafe` 策略。WebSearch、WebFetch 等纯函数 Tool 可并行，提升响应速度；状态性 Tool（echo、时间查询）串行避免竞态。

### ADR-013: Interrupt 中断机制

**Decision**: `AbortSignal` 传递到 `ToolContext`。新增 `interruptBehavior: "cancel" | "block"` 字段控制策略——`"cancel"` 立即 Abort 并清理，`"block"` 等待当前 Tool 自然完成后再处理新消息。

**Rationale**: 用户发送新消息时灵活控制进行中的 Tool。`"cancel"` 适用于 WebFetch 等可丢弃任务，`"block"` 适用于写入数据库等不可中断操作。

### ADR-014: KAIROS 记忆系统

**Decision**: 基于 `MemoryStore` (SQLite/内存) + `Extractor` + `Injector` + `Consolidator` 四组件。Extractor 从对话中提取关键信息，Injector 在每次请求前注入相关记忆，Consolidator 在后台合并重复/过期记忆（auto-dream 机制）。

**Rationale**: 跨 Session 记忆持久化，auto-dream 合并非关键记忆防止上下文膨胀。SQLite 存储确保重启不丢失，内存模式用于测试。

### ADR-015: 双模入口

**Decision**: `src/index.ts`（飞书） + `src/cli.ts`（终端）两个入口点。`src/cli.ts` 使用 `TerminalChannel` + `TerminalRenderer` 实现 REPL 交互；`src/index.ts` 使用 `FeishuChannel` + `FeishuRenderer` 对接飞书。两者共享 `Gateway` + `Harness` 同一套核心逻辑。

**Rationale**: 同一套业务逻辑，两种交互界面。终端入口用于本地调试和快速验证，飞书入口用于生产部署。共享 Harness 确保行为一致。

---

## Phase 完成状态

| Phase | 范围 | 状态 |
|-------|------|------|
| **MVP** | Feishu WebSocket + Claude 对话 + Session 管理 + /ping | ✅ 完成 |
| **P2** | 流式输出 + WebSearch/WebFetch Tool + 图像理解 + 上下文窗口 + validateInput 修复 | ✅ 完成 |
| **P3** | 5 个内置 Tool + 权限框架 + SQLite 持久化 + TokenCounter + RateLimiter | ✅ 完成 |
| **P4** | ProviderRegistry + FallbackProvider + RetryProvider + Coordinator + Agent | ✅ 完成 |
| **P5** | Web 面板 (Express API) + Bridge (WS 远程控制) + 插件系统 + MetricsCollector | ✅ 完成 |

---

## 项目结构

```
src/
├── index.ts                          # 入口
├── config.ts                         # 配置管理
├── types/
│   ├── index.ts                      # 共享类型（Message/ContentBlock/StreamEvent）
│   └── errors.ts                     # 错误类层次（FriclessError 体系）
├── gateway/
│   ├── Gateway.ts                    # 控制平面
│   ├── Router.ts                     # 消息路由
│   └── RateLimiter.ts                # Token Bucket 限流器
├── channels/
│   ├── types.ts                      # Channel 接口（send/sendStream）
│   └── feishu/
│       ├── FeishuChannel.ts          # 飞书 WebSocket 通道（含媒体资源下载）
│       └── types.ts
├── harness/
│   ├── Harness.ts                    # 对话循环引擎（流式 + Tool Use 多轮）
│   ├── Tool.ts                       # Tool 接口 + defineTool 构建器
│   ├── Command.ts                    # Command 接口
│   ├── TokenCounter.ts               # Token 估算工具
│   ├── tools/
│   │   ├── index.ts                  # 聚合导出 builtinTools
│   │   ├── calculator.ts
│   │   ├── web_search.ts             # SerpAPI + DuckDuckGo 双模式
│   │   ├── web_fetch.ts              # URL 获取 + HTML→Markdown
│   │   ├── time.ts
│   │   └── echo.ts
│   └── commands/
│       ├── ping.ts / help.ts / clear.ts
├── providers/
│   ├── types.ts                      # AIProvider 接口（含 countTokens/healthCheck）
│   ├── AnthropicProvider.ts          # Claude API（流式 + ContentBlock）
│   ├── ProviderRegistry.ts           # 工厂注册表
│   ├── FallbackProvider.ts           # 故障切换装饰器
│   └── RetryProvider.ts              # 重试装饰器
├── coordinator/
│   ├── Coordinator.ts                # 多 Agent 编排器
│   └── Agent.ts                      # SubAgent 包装器
├── session/
│   ├── ISessionStore.ts              # 存储接口
│   ├── SessionStore.ts / InMemorySessionStore.ts
│   ├── SQLiteSessionStore.ts         # better-sqlite3 实现
│   └── Session.ts                    # Session 数据模型
├── server/
│   ├── index.ts                      # Express 服务（health/sessions/stats API）
│   └── MetricsCollector.ts           # 指标采集器
├── bridge/
│   ├── BridgeServer.ts               # WebSocket 远程控制
│   └── Protocol.ts                   # 通信协议类型
├── plugins/
│   ├── PluginInterface.ts            # 插件接口
│   ├── PluginManager.ts              # 插件加载器
│   └── EventBus.ts                   # 事件总线
└── __tests__/
    ├── mocks/                        # MockProvider/MockChannel/MockSessionStore
    └── ...                           # 各模块测试
```

---

## 测试状态

| 文件 | 测试数 | 覆盖 |
|------|--------|------|
| `Tool.test.ts` | 10 | 构建器、Schema、默认值 |
| `Harness.test.ts` | 15 | 流式、validateInput、权限、Tool 循环、错误 |
| `Gateway.test.ts` | 7 | 生命周期、广播、错误隔离 |
| `Router.test.ts` | 8 | Session 路由、缓存、清理 |
| `Session.test.ts` | 6 | CRUD、过期、touch |
| `health.test.ts` | 14 | 健康检查、认证、统计、Session 列表 |
| **总计** | **60** | **全部通过** |

---

## TUI 调试承诺

> 本项目的调试遵循"无限循环调试"原则：
> 4. 不发明自己的 Harness 解决方案——Fricless 做不好的地方，直接到 Claude Code 源码借鉴/照抄

## Harness 开发铁律

> **绝不自己发明 Harness 架构解决方案。**
>
> Fricless 的 Harness 设计必须严格以 Claude Code 源码为蓝本：
> 1. 遇到任何 Harness 层面的问题（对话循环、Tool 执行、错误恢复、上下文管理等），先查 Claude Code 源码怎么做的
> 2. 直接复制 Claude Code 的模式、常量、算法，不做自己发明的"优化"
> 3. 只有 Claude Code 源码中没有对应实现时，才自己设计，且需注明理由
> 4. 参考源码地址: https://github.com/pengchengneo/Claude-Code

> 本项目的调试遵循"无限循环调试"原则：
> 1. 每个 Bug 必须通过 TUI 实测验证修复
> 2. 修复后运行完整测试套件（`npm test`）
> 3. 测试通过后推送到 GitHub
> 4. 让用户验证，如果仍有问题则回到步骤 1
> 5. 绝不推卸责任让用户自己跑

---

## 源码参考

- **OpenClaw**: https://github.com/openxjarvis/openclaw-python
- **Claude Code (重构版)**: https://github.com/pengchengneo/Claude-Code
- **飞书开放平台**: https://open.feishu.cn
- **@larksuiteoapi/node-sdk**: https://github.com/larksuite/node-sdk
