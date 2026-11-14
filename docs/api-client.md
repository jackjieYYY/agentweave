# API 调用基础

所有端点从 `@/api` 导出。请求使用同源 `/api` 路径，开发代理已配置；生产反向代理需转发该路径，并关闭 SSE 缓冲。业务合同以 `frontend-api-handoff.md` 为准。

## 模块

- `src/api/types.ts`：请求、响应、审批、执行事件与结果类型。
- `src/api/client.ts`：Bearer 认证、JSON 传输、错误和请求取消。
- `src/api/execution.ts`：POST SSE 解码、事件校验和终态判断。
- `src/api/endpoints.ts`：全部 17 个端点，不绑定 React。
- `src/api/queries.ts`：TanStack Query 的查询键、查询选项和 mutation 选项。
- `src/stores/session.ts`、`src/auth/session.ts`：认证状态与登录生命周期。
- `src/lib/query-client.ts`：应用共用的 QueryClient，查询与 mutation 均不自动重试。

## 登录生命周期

```ts
import { sessionActions } from "@/auth/session";
import { useSession } from "@/stores/session";

await sessionActions.login({ email, password });
const user = useSession.getState().user;
sessionActions.logout();
```

`sessionActions.login` 保存 Token 和当前用户。`api.auth.login` 只返回接口数据，适用于需要自行管理登录生命周期的调用方。注册使用 `api.auth.register`，成功后仍需单独登录。

Token 默认保存到 `sessionStorage`，用户信息与查询缓存只保存在内存。存储受限时可保持当前页面登录。`AppProviders` 启动时调用 `sessionActions.restore()`，通过 `/auth/me` 恢复身份；重复恢复共享在途请求。

`useSession` 的状态为 `anonymous`、`unverified`、`restoring`、`authenticated`。恢复遇到服务故障时保留 Token，状态回到 `unverified`，错误保存在 `error`，可再次调用 `restore()`。受保护请求的 401 清除当前认证；登录 401 返回凭证错误。退出、切换账号或认证失效会取消旧会话请求并清空查询缓存。请求取消也可能停止在途生成。

本地退出只清除当前客户端状态。服务端没有 Token 撤销或刷新接口。

## 直接调用

```ts
import { api } from "@/api";

const providers = await api.providers.list();
const models = await api.models.list();
const conversation = await api.conversations.create();
const detail = await api.conversations.detail(conversation.conversationId);
const page = await api.conversations.list({ limit: 20 });
```

普通请求最后一个参数接受 `{ signal }`。无请求体端点不发送 body 或 JSON Content-Type。响应保持后端原始形状；字段校验由服务端负责，密码原样传输。Provider Key 仅出现在配置写入请求，不进入会话持久化。

## React Query 接入

```ts
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { apiMutations, apiQueries } from "@/api";
import { useSession } from "@/stores/session";

const userId = useSession((state) => state.user?.id);
const providers = useQuery(apiQueries.providers(userId));
const models = useQuery(apiQueries.models(userId));
const conversations = useInfiniteQuery(apiQueries.conversations(userId));
const detail = useQuery(apiQueries.conversation(userId, conversationId));
```

查询选项在没有当前用户时禁用，分页通过 `fetchNextPage()` 获取。会话详情在 `active: true` 时每秒查询一次，执行结束后停止轮询。查询键按用户 ID 隔离，ID 只用于客户端缓存，不作为接口身份参数。

mutation 选项要求已认证的用户 ID，示例用于已通过认证检查的调用位置：

```ts
const create = useMutation(apiMutations.createConversation(user.id));
const update = useMutation(apiMutations.updateModel(user.id, modelId));
const input = useMutation(apiMutations.input(user.id, conversationId, { onEvent }));
```

配置 mutation 会刷新 Provider、模型和会话查询，保证 Provider 名称、启用状态及最近执行模型名称更新。会话 mutation 无论请求成功或失败都会使会话查询失效，便于确认可能已保存的状态。缓存刷新只发起读取，不重发写请求。旧账号的查询或 mutation 选项不能用新账号身份执行。

`api` 的直接调用不处理查询缓存；使用查询缓存的页面应选用 mutation 选项，或通过导出的 `apiKeys` 自行使相关查询失效。

## 执行流

```ts
import { api, type ExecutionEvent } from "@/api";

const controller = new AbortController();
const events: ExecutionEvent[] = [];
const result = await api.conversations.input(
  conversationId,
  { text, modelConfigId },
  { signal: controller.signal, onEvent: (event) => events.push(event) },
);
```

`onEvent` 是同步回调，按 `event.event` 收窄 `event.data`。回调异常会结束流消费，因此应保持轻量并避免抛错。`input`、`continue`、`approve` 共用相同选项，最终返回 `{ status, requestId }`。

`completed` 与 `error` 事件都不会提前结束读取；消费者继续等待 `end` 和 EOF。返回的 `status` 可能是 `completed`、`awaiting_approval`、`unfinished`、`stopped` 或 `error`。Promise 正常返回代表拿到了终态，调用方仍需检查该状态。

流结束后重新读取详情，以 `messages` 重建历史。Query mutation 选项自动触发这次刷新，并按详情中的 `active` 等待收尾。通过直接 API 调用执行时，调用方负责刷新详情。

缺少 `end`、协议异常、断网或主动中止会抛出 `ExecutionOutcomeUnknownError`，原始原因保存在 `cause`。先查询详情，再按 `canContinue`、`canApprove`、`canSubmit` 决定操作。审批为 `unconfirmed` 时不能重发决策或继续执行。写请求没有自动重试或自动续流。

`controller.abort()` 中止流并请求协作停止，保留会话。`api.conversations.close(id)` 对应后端 `/cancel`，会永久关闭会话。

## 错误

HTTP 错误使用 `ApiError`，提供 `status`、`message`、`requestId`；非 JSON 代理错误保留 HTTP 状态和响应头中的请求 ID。普通 JSON 接口的网络异常保留原始 fetch 错误。意外的无效 JSON 响应也会抛出 `ApiError`，其 `status` 保留实际 HTTP 状态。

建立 SSE 前的 HTTP 错误仍为 `ApiError`；收到 `error` 事件并正常获得 `end.status: "error"` 时，返回明确的执行终态。执行请求发生 5xx 或结果未知时，都应先查询会话详情。
