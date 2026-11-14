import { requestJson } from "./client";
import { readExecution } from "./execution";
import type {
  CloseConversationResponse,
  ConversationDetail,
  ConversationInput,
  ConversationListParams,
  ConversationPage,
  CreateConversationResponse,
  CreateModelInput,
  CreateProviderInput,
  Credentials,
  ExecutionOptions,
  HealthResponse,
  LoginResponse,
  ModelConfig,
  ModelWriteResponse,
  Provider,
  ProviderWriteResponse,
  RequestOptions,
  SubmitApprovalsInput,
  UpdateModelInput,
  UpdateProviderInput,
  UserResponse,
} from "./types";

const conversationPath = (id: string) => `/conversations/${encodeURIComponent(id)}`;

export const api = {
  auth: {
    register: (input: Credentials, options?: RequestOptions) =>
      requestJson<UserResponse>("/auth/register", {
        ...options,
        method: "POST",
        body: input,
        authenticated: false,
      }),
    login: (input: Credentials, options?: RequestOptions) =>
      requestJson<LoginResponse>("/auth/login", {
        ...options,
        method: "POST",
        body: input,
        authenticated: false,
      }),
    me: (options?: RequestOptions) => requestJson<UserResponse>("/auth/me", options),
  },
  providers: {
    list: (options?: RequestOptions) => requestJson<Provider[]>("/providers", options),
    create: (input: CreateProviderInput, options?: RequestOptions) =>
      requestJson<ProviderWriteResponse>("/providers", { ...options, method: "POST", body: input }),
    update: (id: string, input: UpdateProviderInput, options?: RequestOptions) =>
      requestJson<ProviderWriteResponse>(`/providers/${encodeURIComponent(id)}`, {
        ...options,
        method: "PATCH",
        body: input,
      }),
  },
  models: {
    list: (options?: RequestOptions) => requestJson<ModelConfig[]>("/models", options),
    create: (input: CreateModelInput, options?: RequestOptions) =>
      requestJson<ModelWriteResponse>("/models", { ...options, method: "POST", body: input }),
    update: (id: string, input: UpdateModelInput, options?: RequestOptions) =>
      requestJson<ModelWriteResponse>(`/models/${encodeURIComponent(id)}`, {
        ...options,
        method: "PATCH",
        body: input,
      }),
  },
  conversations: {
    list: (params: ConversationListParams = {}, options?: RequestOptions) => {
      const query = new URLSearchParams();
      if (params.limit !== undefined) query.set("limit", String(params.limit));
      if (params.cursor !== undefined) query.set("cursor", params.cursor);
      const suffix = query.size ? `?${query}` : "";
      return requestJson<ConversationPage>(`/conversations${suffix}`, options);
    },
    create: (options?: RequestOptions) =>
      requestJson<CreateConversationResponse>("/conversations", { ...options, method: "POST" }),
    detail: (id: string, options?: RequestOptions) =>
      requestJson<ConversationDetail>(conversationPath(id), options),
    input: (id: string, input: ConversationInput, options?: ExecutionOptions) =>
      readExecution(`${conversationPath(id)}/input`, input, options),
    continue: (id: string, options?: ExecutionOptions) =>
      readExecution(`${conversationPath(id)}/continue`, undefined, options),
    approve: (id: string, input: SubmitApprovalsInput, options?: ExecutionOptions) =>
      readExecution(`${conversationPath(id)}/approvals`, input, options),
    close: (id: string, options?: RequestOptions) =>
      requestJson<CloseConversationResponse>(`${conversationPath(id)}/cancel`, {
        ...options,
        method: "POST",
      }),
  },
  health: (options?: RequestOptions) =>
    requestJson<HealthResponse>("/health", { ...options, authenticated: false }),
};
