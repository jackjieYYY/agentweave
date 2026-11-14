# Agentloom 前端 API 交接文档

本文以当前工作区的路由、认证、模型管理和执行实现为准，覆盖 17 个业务端点。用于账号页、模型配置页、会话列表与聊天页接入。

## 1. 接入约定

- 默认开发地址：`http://127.0.0.1:3000`，实际地址由部署环境提供。应用路由没有 `/api` 前缀；网关可自行映射。
- 除注册、登录和健康检查外，所有接口必须带 `Authorization: Bearer <accessToken>`。身份由 Token 决定，请求无需传入用户 ID。
- 有 JSON 请求体时使用 `Content-Type: application/json`。标注“无请求体或 `{}`”的端点推荐直接不发送 body，也不设置 Content-Type；不要发送空字符串 JSON 或 `null`。
- 成功响应没有统一 `data` 包装。列表、对象和创建结果的结构分别见下文。
- JSON 字段采用 camelCase；UUID 为字符串；时间为 ISO 8601 字符串，前端按用户时区展示。可空字段明确返回 `null`。
- 请求体采用严格字段校验，未知字段返回 400。PATCH 必须至少包含一个允许的字段，省略字段保留原值，不能用 `null` 清空。
- 所有响应包含服务端生成的 `x-request-id`；JSON 错误体与 SSE 事件也包含 `requestId`。排障时保留此值，不依赖客户端传入的请求 ID。
- 账号接口设置 `Cache-Control: no-store`。前端应在切换账号后清空用户、会话及其他账号相关缓存。

### 浏览器与部署

当前 API 没有注册 CORS。浏览器直接从 `http://localhost:5173` 访问 `http://127.0.0.1:3000` 等不同源地址时，JSON 或 Authorization 请求会触发预检，`OPTIONS` 返回 404。前端开发环境应通过开发服务器代理访问，部署时使用同源反向代理；需要浏览器直接跨域访问时，应先交付对应 CORS 支持。

执行状态和同会话互斥保存在单个应用实例内。当前交接按单实例 API 部署；增加多实例前需要统一会话执行准入，否则查询 `active` 和取消执行不能跨实例协调。

反向代理需支持持续传输 SSE、关闭响应缓冲，并设置适合执行时长的读超时。API 默认单次执行超时 120 秒，可由环境调整。到达超时时间后会请求协作停止；模型和工具退出前，`active` 可能仍为 `true`，SSE 连接也可能尚未结束。前端等待状态和代理读超时需为执行收尾留出余量。流中没有心跳事件，等待模型期间可能暂时没有数据。

## 2. 接口总览

| 方法  | 路径                                       | 认证 | 成功状态 | 返回形式                |
| ----- | ------------------------------------------ | ---- | -------- | ----------------------- |
| POST  | `/auth/register`                           | 否   | 201      | `{ user }`              |
| POST  | `/auth/login`                              | 否   | 200      | Token 与用户            |
| GET   | `/auth/me`                                 | 是   | 200      | `{ user }`              |
| GET   | `/providers`                               | 是   | 200      | Provider 数组           |
| POST  | `/providers`                               | 是   | 201      | `{ providerId }`        |
| PATCH | `/providers/:id`                           | 是   | 200      | `{ providerId }`        |
| GET   | `/models`                                  | 是   | 200      | 模型数组                |
| POST  | `/models`                                  | 是   | 201      | `{ modelConfigId }`     |
| PATCH | `/models/:id`                              | 是   | 200      | `{ modelConfigId }`     |
| GET   | `/conversations`                           | 是   | 200      | `{ items, nextCursor }` |
| POST  | `/conversations`                           | 是   | 201      | 会话 ID 与创建时间      |
| GET   | `/conversations/:conversationId`           | 是   | 200      | 会话详情与可操作状态    |
| POST  | `/conversations/:conversationId/input`     | 是   | 200      | SSE                     |
| POST  | `/conversations/:conversationId/continue`  | 是   | 200      | SSE                     |
| POST  | `/conversations/:conversationId/approvals` | 是   | 200      | SSE                     |
| POST  | `/conversations/:conversationId/cancel`    | 是   | 200      | 关闭后的会话信息        |
| GET   | `/health`                                  | 否   | 200      | `{ status: "ok" }`      |

当前没有刷新 Token、服务端退出、改密、找回密码、删除会话、重命名会话、修改会话默认模型、删除 Provider 或删除模型的接口。

## 3. 注册与登录

### 3.1 公共类型

```ts
interface User {
  id: string;
  email: string;
  createdAt: string;
}

interface Credentials {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number; // 固定 604800，单位秒
  user: User;
}
```

注册与登录使用同一套字段校验：

| 字段       | 规则                                                      |
| ---------- | --------------------------------------------------------- |
| `email`    | 必填字符串；去除首尾空白、转为小写后校验邮箱；最长 254    |
| `password` | 必填字符串；15–128 个 Unicode 码点；保留首尾空白，不 trim |

密码长度可用 `[...password].length` 计算。注册表单和登录表单均应保留用户输入的完整密码，不附加大小写或特殊字符要求。

### 3.2 `POST /auth/register`

```json
{
  "email": "alice@example.com",
  "password": "my long account passphrase"
}
```

201 响应：

```json
{
  "user": {
    "id": "57f2be46-ea7a-4cba-a681-b1ef731dc8df",
    "email": "alice@example.com",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

注册后账号直接启用；响应不包含 Token。前端随后调用登录接口。规范化后的邮箱重复时返回 409 `Email already registered`。

### 3.3 `POST /auth/login`

请求体同注册。200 响应为 `LoginResponse`：

```json
{
  "accessToken": "<JWT>",
  "tokenType": "Bearer",
  "expiresIn": 604800,
  "user": {
    "id": "57f2be46-ea7a-4cba-a681-b1ef731dc8df",
    "email": "alice@example.com",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

邮箱不存在、密码错误或账号停用，统一返回 401 `Invalid credentials`。Token 有效期固定 7 天，没有自动续签或刷新接口，不使用登录 Cookie。

### 3.4 `GET /auth/me`

无请求体，200 返回 `{ user: User }`。前端恢复登录状态时可调用此接口。受保护请求会校验用户当前存在且启用；Token 过期、无效或用户不可用时返回 401 `Invalid request`，并带 `WWW-Authenticate: Bearer`。

受保护接口的 401 应清理本地登录状态并引导重新登录。登录接口的 401 应作为表单错误展示。数据库故障可能返回 500，不应误判成登录失效。

当前没有服务端 Token 撤销接口。清除本地 Token 仅结束当前客户端持有的登录状态，不能作为全设备退出的承诺；全设备退出能力需要单独交付。

## 4. Provider 与模型配置

配置在所有认证用户间全局共享，所有认证用户都可以查询、创建、修改和使用。当前没有管理员角色字段。编辑或停用配置会影响其他用户的后续执行，前端应明确展示其共享范围。

### 4.1 数据类型

```ts
type ProviderType = "openai" | "openai-compatible";

interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ModelConfig {
  id: string;
  modelName: string;
  providerId: string;
  providerName: string;
  enabled: boolean;
  providerEnabled: boolean;
}
```

Provider 的 `name` 是展示名称；模型的 `modelName` 同时用于展示和上游调用。模型响应没有别名 `name`、`isDefault`、时间字段或 Provider 地址。API 不返回明文或密文 Key。

### 4.2 `GET /providers`

无请求参数，返回 `Provider[]`，包括停用项，按 `name`、`id` 升序。没有分页或详情接口。

### 4.3 `POST /providers`

| 字段      | 必填     | 规则                                                       |
| --------- | -------- | ---------------------------------------------------------- |
| `name`    | 是       | trim 后长度 1–200                                          |
| `type`    | 是       | `openai` 或 `openai-compatible`                            |
| `baseUrl` | 条件必填 | 最长 2048；HTTPS URL，不含用户名、密码、查询参数、fragment |
| `apiKey`  | 是       | trim 后长度 1–8192，不能包含回车或换行                     |
| `enabled` | 否       | boolean，默认 `true`                                       |

`openai` 未指定 `baseUrl` 时默认 `https://api.openai.com/v1`；`openai-compatible` 必须显式填写地址，并使用 Chat Completions 协议。

```json
{
  "name": "主要模型服务",
  "type": "openai-compatible",
  "baseUrl": "https://models.example/v1",
  "apiKey": "<API_KEY>",
  "enabled": true
}
```

201 返回 `{ "providerId": "<UUID>" }`。创建只保存配置，不验证上游凭证或模型实际可用性。

### 4.4 `PATCH /providers/:id`

路径 `id` 为 Provider UUID。请求接受上述五个字段的任意非空子集，200 返回 `{ "providerId": "<UUID>" }`。

编辑页的 Key 输入框不回填已有 Key。用户未修改 Key 时应省略 `apiKey`，不能提交空字符串。修改 `type` 会保留原地址；需要切换地址时一起提交 `baseUrl`。

停用通过 `{ "enabled": false }` 完成。修改不会中断在途执行，后续输入、继续执行和审批恢复读取最新配置。

### 4.5 `GET /models`

无请求参数，返回 `ModelConfig[]`，按 `modelName`、`id` 升序。包括停用模型以及停用 Provider 下的模型。

聊天模型选择器按 `enabled && providerEnabled` 筛选；这表示配置启用，不保证上游服务可达。实际执行时服务端再次校验。

### 4.6 `POST /models`

| 字段         | 必填 | 规则                                            |
| ------------ | ---- | ----------------------------------------------- |
| `providerId` | 是   | 已存在的 Provider UUID，允许关联停用的 Provider |
| `modelName`  | 是   | trim 后长度 1–200，上游模型标识                 |
| `enabled`    | 否   | boolean，默认 `true`                            |

```json
{
  "providerId": "<PROVIDER_UUID>",
  "modelName": "gpt-4o"
}
```

201 返回 `{ "modelConfigId": "<UUID>" }`。

### 4.7 `PATCH /models/:id`

路径 `id` 为模型配置 UUID。只接受 `modelName`、`enabled` 的任意非空子集，200 返回 `{ "modelConfigId": "<UUID>" }`。Provider 关联在创建后固定，传入 `providerId` 或 `isDefault` 返回 400。

配置写入接口只返回 ID，前端需要完整行数据时重新读取对应列表。后端不保证名称唯一，选择器与缓存都应以 ID 区分记录。

## 5. 会话列表与详情

所有会话接口只访问当前用户的会话。不存在和属于其他用户的会话均返回 404 `Not found`。

### 5.1 公共类型

```ts
interface ConversationSummary {
  conversationId: string;
  createdAt: string;
  closedAt: string | null;
  lastExecutionModelConfigId: string | null;
}

type ApprovalDecision = { type: "approve" | "reject" };

interface Approval {
  interruptId: string;
  actions: Array<{
    toolName: string;
    argumentSummary: string;
    allowedDecisions: Array<"approve" | "reject">;
  }>;
  decisionStatus: "pending" | "unconfirmed";
}

interface ConversationDetail extends ConversationSummary {
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
```

### 5.2 `POST /conversations`

无请求体或 `{}`，201 返回：

```json
{
  "conversationId": "<UUID>",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

创建时不传模型。后端没有会话标题或默认模型。

### 5.3 `GET /conversations?limit=20&cursor=<UUID>`

| 参数     | 必填 | 规则                                  |
| -------- | ---- | ------------------------------------- |
| `limit`  | 否   | 十进制数字字符串，数值 1–100，默认 20 |
| `cursor` | 否   | 上一页返回的 `nextCursor`，UUID       |

只接受这两个查询参数。200 返回：

```ts
interface ConversationPage {
  items: ConversationSummary[];
  nextCursor: string | null;
}
```

包含已关闭会话，按创建时间倒序，再按 ID 倒序；不是按最近消息时间排序。`nextCursor === null` 表示没有下一页。游标不存在或不属于当前用户时返回 404。列表不含消息、执行状态或可操作字段，聊天页需要读取详情。

### 5.4 `GET /conversations/:conversationId`

返回 `ConversationDetail`。新建会话的主要状态为：

```json
{
  "conversationId": "<UUID>",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "closedAt": null,
  "lastExecutionModelConfigId": null,
  "lastExecutionModel": null,
  "active": false,
  "awaitingApproval": false,
  "unfinished": false,
  "approvals": [],
  "approvalAudit": [],
  "canApprove": false,
  "canSubmit": true,
  "canContinue": false,
  "messages": []
}
```

前端直接使用服务端的可操作字段控制按钮：

| 字段                | UI 含义                                                        |
| ------------------- | -------------------------------------------------------------- |
| `closedAt !== null` | 会话已永久关闭，只读                                           |
| `active`            | 执行及其清理仍在进行，禁用发送、继续与审批                     |
| `canSubmit`         | 允许发送新消息；还需用户选择可用模型                           |
| `canContinue`       | 允许继续未完成工作                                             |
| `canApprove`        | 至少有一个可提交审批的中断；仅对 `pending` 项显示提交操作      |
| `awaitingApproval`  | 当前有审批中断，不允许通过新消息或 continue 绕过               |
| `unfinished`        | checkpoint 仍有待执行节点，可与 `awaitingApproval` 同时为 true |

这些字段是查询时的状态，提交时可能因并发操作变更而返回 409。详情不是原子状态订阅；收到冲突后重新查询。

`messages` 只包含非空的用户和助手文本，不包含消息 ID、逐消息时间、工具参数、工具结果、推理过程或用量；也没有消息分页。一次执行可能产生多条助手文本。刷新页面时以该列表重建历史。

`lastExecutionModel` 展示对应配置当前的 `modelName`，不是逐消息模型快照。历史模型 ID 仅表示最近执行选择；每次新输入仍需明确提交模型 ID。

## 6. 新输入、继续执行与审批

以下三个端点成功时均返回 SSE，建立流前的校验失败则返回非 2xx JSON 错误。不能仅凭 HTTP 200 判断执行成功。

### 6.1 `POST /conversations/:conversationId/input`

```json
{
  "text": "你好",
  "modelConfigId": "<MODEL_CONFIG_UUID>"
}
```

`text` 必填，trim 后长度 1–32000；`modelConfigId` 必填且为 UUID。这里的长度使用 JavaScript 字符串长度，与密码的 Unicode 码点计数不同。

每次新输入必须指定模型。前端可自行保存默认选择。模型或其 Provider 不存在或停用时返回 404 `Model not found`，不会自动切换模型。

### 6.2 `POST /conversations/:conversationId/continue`

无请求体或 `{}`。仅在 `canContinue` 为 true 时使用，不重复提交用户文本，也不传模型 ID。

沿用 `lastExecutionModelConfigId`，读取该配置当前的模型名称、地址、协议和 Key。模型配置停用时不能继续，可在重新启用后再操作。每次继续执行重新获得调用预算与超时时间。

继续执行以最近保存的 checkpoint 为基础，可能重新执行尚未保存完成的模型或工具调用。流中的文本预览不代表已保存的恢复位置，执行后以详情中的 `messages` 重建历史。

服务重启不会自动调用模型或工具。前端应重新查询会话详情，按 `canContinue`、`canApprove`、`canSubmit` 提供操作，并遵循审批恢复流程。

### 6.3 `POST /conversations/:conversationId/approvals`

在 `canApprove` 为 true 且目标项 `decisionStatus === "pending"` 时提交：

```json
{
  "interruptId": "<从 approvals 中读取的原始字符串>",
  "decisions": [{ "type": "approve" }, { "type": "reject" }]
}
```

- `interruptId` 是非空字符串，不要求 UUID，不由前端生成。
- `decisions` 至少一项，数量必须等于目标中断的 `actions.length`，并按 actions 原顺序逐项对应。每项只允许 `type` 字段。
- 当前支持 approve / reject，不支持修改工具参数或拒绝原因；按 `allowedDecisions` 渲染选择。
- 当前 echo 工具需要审批。其 `argumentSummary` 只展示文本前 200 个 JavaScript 字符，其他工具的摘要为空；摘要不能当作完整参数。
- reject 拒绝本次工具请求，Agent 会继续处理结果，可能再次申请新的审批；不等同于关闭会话。
- 审批恢复也沿用最近执行模型 ID，读取最新配置。

服务端先记录审批回执再恢复执行。`approvalAudit` 表示已记录决策，不证明工具执行成功。若相同中断仍存在且已经有回执，返回 `decisionStatus: "unconfirmed"`，此时不可重新提交或用 continue 绕过，重复提交返回 409 `Decision outcome unconfirmed`。

审批请求遇到断网、5xx 或页面刷新时，不自动重发。先查询会话：如果仍 active，等待结束；如果是 pending，提示用户确认后提交；如果是 unconfirmed，展示“审批结果未确认”，提供关闭会话并新建会话的入口。审批不会因等待时间到达自动过期。

## 7. SSE 协议与前端消费

### 7.1 传输

使用带 Authorization 的 `fetch` POST 读取流，浏览器原生 `EventSource` 不适合这些 POST 接口。

成功响应头：

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache
X-Accel-Buffering: no
X-Request-Id: <UUID>
```

事件格式为事件名、单行 JSON data 和一个空行：

```text
event: message
data: {"text":"你好","requestId":"<UUID>"}

event: completed
data: {"requestId":"<UUID>"}

event: end
data: {"status":"completed","requestId":"<UUID>"}

```

### 7.2 事件清单

以下每种 data 都额外包含 `requestId: string`。

| event               | 业务 data                                              | 处理方式                                |
| ------------------- | ------------------------------------------------------ | --------------------------------------- |
| `message`           | `{ text: string }`                                     | 本次到达的助手文本片段，按顺序追加      |
| `tool`              | `{ name?: string, status: "requested" \| "finished" }` | 展示工具请求或结束提示                  |
| `awaiting_approval` | `{ approvals: Approval[] }`                            | 展示审批信息，并在流结束后查询详情      |
| `completed`         | `{}`                                                   | 本次执行完成通知，继续读取至 end/EOF    |
| `error`             | `{ error: "Execution failed" }`                        | 展示安全错误提示，继续读取 end          |
| `end`               | `{ status: ExecutionStatus }`                          | 记录本次执行终态，读取到 EOF 后刷新详情 |

```ts
type ExecutionStatus = "completed" | "awaiting_approval" | "unfinished" | "stopped" | "error";
```

`stopped` 可能来自断连、超时、服务停止或取消；事件不携带停止原因。模型或工具调用超过预算时，与其他执行错误一样发送 `error` 事件，并以 `end.status: "error"` 结束，响应不区分具体错误原因。`unfinished` 和 `stopped` 没有同名独立事件，只通过 end 传达。

工具事件没有调用 ID、参数、结果或成功标记，不能用 `name` 唯一匹配同名并行调用；`finished` 也不能作为业务成功证据。message 没有消息 ID 或边界标识，适合本次执行的文本预览，最终历史以详情 messages 为准。

正常可写连接会发送 end 后关闭。断网或传输异常可能收不到 end；收到 EOF 但没有 end 时应视为结果未知并查询详情。end 发出后执行槽位可能仍在清理，查询结果可能短暂 `active: true`，前端应继续以有间隔的查询等待 active 变为 false。

当前没有 SSE 事件 ID、断点续传或 `Last-Event-ID` 恢复机制。禁止通过自动重发 input 来重连，否则可能产生重复用户消息。恢复流程统一使用 GET 详情，再按 canContinue / canApprove / canSubmit 决定下一步。

### 7.3 fetch 消费示例

以下 JavaScript 示例按当前服务端协议消费事件，可用于 input、continue 和 approvals。`onEvent` 是同步回调；建议更新本次执行预览，流结束后另行获取详情。

```js
async function readExecution(url, token, body, onEvent, signal) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/event-stream",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal,
  });
  if (!response.ok) {
    const detail = await response.json();
    throw Object.assign(new Error(detail.error), {
      status: response.status,
      requestId: detail.requestId,
    });
  }
  if (!response.headers.get("content-type")?.includes("text/event-stream")) {
    throw new Error("Unexpected response type");
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let endStatus;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const lines = frame.split("\n");
        const event = lines.find((line) => line.startsWith("event: "))?.slice(7);
        const json = lines.find((line) => line.startsWith("data: "))?.slice(6);
        if (!event || json === undefined) continue;
        const data = JSON.parse(json);
        if (event === "end") endStatus = data.status;
        onEvent(event, data);
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (!endStatus) throw new Error("Execution outcome unknown; query conversation");
  return endStatus;
}
```

网络块与事件边界不同：一次读取可能只有半个事件，也可能包含多个事件。示例保留未完成 frame，使用流式 UTF-8 解码，支持中文字符跨网络块。

调用示例：

```js
const status = await readExecution(
  `/conversations/${conversationId}/input`,
  accessToken,
  { text: "你好", modelConfigId },
  (event, data) => {
    if (event === "message") appendPreview(data.text);
  },
  abortController.signal,
);
// 随后 GET 会话详情；status 为 error/stopped 也需要刷新。
```

AbortController 中止 fetch 会断开流，并触发服务端协作停止，但不关闭会话。捕获网络异常或主动中止后也要查询详情；checkpoint 中是否已有输入以查询结果为准。切换页面可能影响仍在执行的请求，前端应明确选择保留请求还是中止并恢复。

## 8. 关闭会话

### `POST /conversations/:conversationId/cancel`

无请求体或 `{}`，200 返回 `ConversationSummary` 加上 `active: boolean`：

```json
{
  "conversationId": "<UUID>",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "closedAt": "2026-01-01T00:01:00.000Z",
  "lastExecutionModelConfigId": "<MODEL_CONFIG_UUID>",
  "active": true
}
```

此接口永久关闭会话，并请求停止在途执行。关闭后仍可读取历史，但不能新输入、继续或审批；没有重新打开接口。UI 文案应使用“关闭会话”，并告知用户关闭后只读。

重复调用保留首次 closedAt。`active: true` 表示执行仍在收尾，不代表关闭失败。该接口不等待执行完全退出，前端应继续查询详情。

若产品需要“停止生成后继续当前会话”，现有可用行为是中止当前 fetch 并查询保存状态；不能将 cancel 用作可恢复的停止按钮。

## 9. 错误处理

HTTP JSON 错误结构：

```ts
interface ApiError {
  error: string;
  requestId: string;
}
```

| 状态 | error / 场景                                               | 前端处理                                           |
| ---- | ---------------------------------------------------------- | -------------------------------------------------- |
| 400  | `Invalid request`：字段、UUID、未知字段、空 PATCH 等不合法 | 检查本地字段；服务端没有逐字段 issues              |
| 400  | `Invalid approval decisions`                               | 决策数量与 actions 不匹配，刷新审批数据            |
| 401  | `Invalid credentials`                                      | 登录凭证不正确，展示表单错误                       |
| 401  | `Invalid request`                                          | 受保护请求认证失败，清理登录状态并重新登录         |
| 404  | `Not found`                                                | 会话/游标不可访问，或路由不存在                    |
| 404  | `Provider not found`                                       | 配置的 Provider 不存在，刷新列表                   |
| 404  | `Model not found`                                          | 模型不存在或执行时模型/Provider 停用，刷新选择器   |
| 409  | `Email already registered`                                 | 提示邮箱已注册                                     |
| 409  | `Conversation closed`                                      | 转只读，允许新建会话                               |
| 409  | `Execution active`                                         | 等待执行收尾并查询详情                             |
| 409  | `Approval required`                                        | 展示审批 UI                                        |
| 409  | `No unfinished work`                                       | 不能 continue，查询详情                            |
| 409  | `Unfinished work`                                          | 不能新输入，按 canContinue 操作                    |
| 409  | `Approval not pending`                                     | 审批已变化，刷新详情                               |
| 409  | `Decision outcome unconfirmed`                             | 禁止重发决策，展示未确认状态                       |
| 500  | `Internal server error`                                    | 保留 requestId，提示服务异常；执行写请求先查询状态 |
| 503  | `Model configuration unavailable`                          | 模型凭证服务不可用，联系服务端配置                 |
| 503  | `Server stopping`                                          | 服务停止中，稍后查询状态                           |
| 503  | `Database unavailable`                                     | 健康检查的数据库失败                               |

框架层错误可能保留其他 4xx 状态，例如请求体过大 413、媒体类型不支持 415；其消息统一为 `Invalid request`。不要把所有非 2xx 都当作认证失败。

SSE 已建立后的执行失败以 `error` 和 `end.status` 反馈，HTTP 状态仍为 200。不要将 HTTP JSON 错误与 SSE error 事件使用同一解析入口。

创建和执行写请求没有通用幂等键。遇到断网时避免自动重发；先刷新列表或详情确认已保存状态。审批额外受回执约束，必须遵循审批恢复流程。

## 10. 健康检查

`GET /health` 无需认证，执行数据库连通性检查。成功返回 200 `{ "status": "ok" }`；数据库失败返回 503 `{ "error": "Database unavailable", "requestId": "<UUID>" }`。

健康成功不表示上游模型可用，也不验证模型配置或 API Key。

## 11. 前端联调顺序

1. 配置同源代理，注册账号并登录，使用 accessToken 调用 `/auth/me`。
2. 创建 Provider 与模型，确认列表不回显 Key，选择器只允许启用的模型和 Provider。
3. 创建会话，读取详情，发送携带模型 ID 的新输入，验证中文 SSE、工具提示与完成状态。
4. 流结束后以详情重建消息；刷新页面验证历史和可操作按钮。
5. 触发 echo 审批，按 actions 顺序 approve/reject；验证 reject 后仍可能产生新的审批。
6. 中断流，查询详情，按 canContinue 继续，确认不会重复提交原用户文本。
7. 在另一个客户端操作同会话，验证 409 后刷新状态；使用另一个账号验证会话返回 404。
8. 关闭会话，验证只读与重复关闭；验证登录 401、受保护请求 401、模型不可用 404 的不同提示。

实现依据：`src/routes/`、`src/users/accounts.ts`、`src/plugins/auth.ts`、`src/plugins/errors/handler.ts`、`src/models/manage.ts`、`src/models/configuration.ts`、`src/runtime/execution.ts`。账号、模型和执行的行为断言分别位于 `tests/auth.integration.test.ts`、`tests/models.integration.test.ts`、`tests/execution.integration.test.ts`。

本次核验包括路由注册、认证与字段校验、浏览器跨域预检、编译及现有 6 个核心单元测试。文档中的 SSE 示例已通过完整事件合并、逐字节 UTF-8 拆分、缺少 end、HTTP 错误、SSE 执行错误和无请求体 continue 的独立校验。数据库集成测试与真实上游模型、浏览器页面和代理环境联调未在本次执行，以上联调顺序用于前后端交接验收。
