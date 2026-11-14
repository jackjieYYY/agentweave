export class ApiError extends Error {
  readonly status: number;
  readonly requestId: string | null;

  constructor(status: number, message: string, requestId: string | null, options?: ErrorOptions) {
    super(message, options);
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
  }
}

export class ExecutionOutcomeUnknownError extends Error {
  readonly requestId: string | null;

  constructor(requestId: string | null, options?: ErrorOptions) {
    super("Execution outcome unknown; query conversation", options);
    this.name = "ExecutionOutcomeUnknownError";
    this.requestId = requestId;
  }
}
