export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface UserResponse {
  user: User;
}

export interface LoginResponse extends UserResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

export type ProviderType = "openai" | "openai-compatible";

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateProviderInput = {
  name: string;
  apiKey: string;
  enabled?: boolean;
} & ({ type: "openai"; baseUrl?: string } | { type: "openai-compatible"; baseUrl: string });

export interface UpdateProviderInput {
  name?: string;
  type?: ProviderType;
  baseUrl?: string;
  apiKey?: string;
  enabled?: boolean;
}

export interface ProviderWriteResponse {
  providerId: string;
}

export interface ModelConfig {
  id: string;
  modelName: string;
  providerId: string;
  providerName: string;
  enabled: boolean;
  providerEnabled: boolean;
}

export interface CreateModelInput {
  providerId: string;
  modelName: string;
  enabled?: boolean;
}

export interface UpdateModelInput {
  modelName?: string;
  enabled?: boolean;
}

export interface ModelWriteResponse {
  modelConfigId: string;
}

export interface ConversationSummary {
  conversationId: string;
  createdAt: string;
  closedAt: string | null;
  lastExecutionModelConfigId: string | null;
}

export interface ConversationPage {
  items: ConversationSummary[];
  nextCursor: string | null;
}

export interface ConversationListParams {
  limit?: number;
  cursor?: string;
}

export interface CreateConversationResponse {
  conversationId: string;
  createdAt: string;
}

export interface CloseConversationResponse extends ConversationSummary {
  active: boolean;
}

export type ApprovalDecisionType = "approve" | "reject";

export interface ApprovalDecision {
  type: ApprovalDecisionType;
}

export interface Approval {
  interruptId: string;
  actions: Array<{
    toolName: string;
    argumentSummary: string;
    allowedDecisions: ApprovalDecisionType[];
  }>;
  decisionStatus: "pending" | "unconfirmed";
}

export interface ConversationDetail extends ConversationSummary {
  lastExecutionModel: { id: string; modelName: string } | null;
  active: boolean;
  awaitingApproval: boolean;
  unfinished: boolean;
  approvals: Approval[];
  approvalAudit: Array<{
    interruptId: string;
    decisions: ApprovalDecision[];
    userId: string;
    createdAt: string;
  }>;
  canApprove: boolean;
  canSubmit: boolean;
  canContinue: boolean;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  error?: "Execution failed";
}

export interface ConversationInput {
  text: string;
  modelConfigId: string;
}

export interface SubmitApprovalsInput {
  interruptId: string;
  decisions: ApprovalDecision[];
}

export type ExecutionStatus =
  | "completed"
  | "awaiting_approval"
  | "unfinished"
  | "stopped"
  | "error";

type ExecutionEventData = {
  message: { text: string };
  tool: { name?: string; status: "requested" | "finished" };
  awaiting_approval: { approvals: Approval[] };
  completed: { requestId: string };
  error: { error: "Execution failed" };
  end: { status: ExecutionStatus };
};

export type ExecutionEvent = {
  [Event in keyof ExecutionEventData]: {
    event: Event;
    data: ExecutionEventData[Event] & { requestId: string };
  };
}[keyof ExecutionEventData];

export interface ExecutionResult {
  status: ExecutionStatus;
  requestId: string;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface ExecutionOptions extends RequestOptions {
  onEvent?: (event: ExecutionEvent) => void;
}

export interface HealthResponse {
  status: "ok";
}
