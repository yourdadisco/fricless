/**
 * 飞书平台相关类型
 *
 * MVP 阶段大部分类型由 @larksuiteoapi/node-sdk 提供。
 * 这里只定义 SDK 未覆盖的补充类型。
 */

/** 飞书消息内容类型 */
export type FeishuMsgType = 'text' | 'image' | 'file' | 'audio' | 'media' | 'sticker' | 'interactive' | 'share_chat' | 'share_user' | 'post' | 'system';
