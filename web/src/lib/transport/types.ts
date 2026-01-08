/**
 * 领域模型类型定义
 * 与 Go internal/domain/model.go 保持同步
 */

// ===== 基础类型 =====

export type ClientType = 'claude' | 'codex' | 'gemini' | 'openai';

// ===== Provider 相关 =====

export interface ProviderConfigCustom {
  baseURL: string;
  apiKey: string;
  clientBaseURL?: Partial<Record<ClientType, string>>;
  modelMapping?: Record<string, string>;
}

export interface ProviderConfigAntigravity {
  email: string;
  refreshToken: string;
  projectID: string;
  endpoint: string;
  modelMapping?: Record<string, string>;
}

export interface ProviderConfig {
  custom?: ProviderConfigCustom;
  antigravity?: ProviderConfigAntigravity;
}

export interface Provider {
  id: number;
  createdAt: string;
  updatedAt: string;
  type: string;
  name: string;
  config: ProviderConfig | null;
  supportedClientTypes: ClientType[];
}

export type CreateProviderData = Omit<Provider, 'id' | 'createdAt' | 'updatedAt'>;

// ===== Project =====

export interface Project {
  id: number;
  createdAt: string;
  updatedAt: string;
  name: string;
}

export type CreateProjectData = Omit<Project, 'id' | 'createdAt' | 'updatedAt'>;

// ===== Session =====

export interface Session {
  id: number;
  createdAt: string;
  updatedAt: string;
  sessionID: string;
  clientType: ClientType;
  projectID: number;
}

// ===== Route =====

export interface Route {
  id: number;
  createdAt: string;
  updatedAt: string;
  isEnabled: boolean;
  isNative: boolean; // 是否为原生支持（自动创建），false 表示转换支持（手动创建）
  projectID: number;
  clientType: ClientType;
  providerID: number;
  position: number;
  retryConfigID: number;
  modelMapping?: Record<string, string>;
}

export type CreateRouteData = Omit<Route, 'id' | 'createdAt' | 'updatedAt'>;

// ===== RetryConfig =====

export interface RetryConfig {
  id: number;
  createdAt: string;
  updatedAt: string;
  name: string;
  isDefault: boolean;
  maxRetries: number;
  initialInterval: number; // nanoseconds
  backoffRate: number;
  maxInterval: number; // nanoseconds
}

export type CreateRetryConfigData = Omit<RetryConfig, 'id' | 'createdAt' | 'updatedAt'>;

// ===== RoutingStrategy =====

export type RoutingStrategyType = 'priority' | 'weighted_random';

export interface RoutingStrategyConfig {
  // 扩展字段
}

export interface RoutingStrategy {
  id: number;
  createdAt: string;
  updatedAt: string;
  projectID: number;
  type: RoutingStrategyType;
  config: RoutingStrategyConfig | null;
}

export type CreateRoutingStrategyData = Omit<RoutingStrategy, 'id' | 'createdAt' | 'updatedAt'>;

// ===== ProxyRequest =====

export interface RequestInfo {
  method: string;
  headers: Record<string, string>;
  url: string;
  body: string;
}

export interface ResponseInfo {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export type ProxyRequestStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface ProxyRequest {
  id: number;
  createdAt: string;
  updatedAt: string;
  requestID: string;
  sessionID: string;
  clientType: ClientType;
  requestModel: string;
  responseModel: string;
  startTime: string;
  endTime: string;
  duration: number; // nanoseconds
  status: ProxyRequestStatus;
  requestInfo: RequestInfo | null;
  responseInfo: ResponseInfo | null;
  error: string;
  proxyUpstreamAttemptCount: number;
  finalProxyUpstreamAttemptID: number;
  inputTokenCount: number;
  outputTokenCount: number;
  cacheReadCount: number;
  cacheWriteCount: number;
  cost: number;
}

// ===== 分页 =====

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

// ===== WebSocket 消息 =====

export type WSMessageType = 'proxy_request_update' | 'stats_update' | 'log_message';

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  data: T;
}

// ===== Proxy Status =====

export interface ProxyStatus {
  running: boolean;
  address: string;
  port: number;
}

// ===== 回调类型 =====

export type EventCallback<T = unknown> = (data: T) => void;
export type UnsubscribeFn = () => void;
