# AgentWeave

AgentLoom 的 React 前端，使用 Vite 官方 React + TypeScript 脚手架与 shadcn/ui CLI 初始化。

## 开发

Node.js 24（>=24.16.0）、pnpm 11.7.0。

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

打开开发服务器输出的地址，默认 http://localhost:5173。

## 技术栈

- React + TypeScript（严格模式）、Vite
- Tailwind CSS v4，通过 @tailwindcss/vite 集成
- shadcn/ui：Radix 基础、Nova 样式，组件源码位于 src/components/ui
- cn、class-variance-authority、lucide-react、tw-animate-css
- React Router、TanStack Query、Zustand persist
- Vitest、jsdom、Testing Library
- Oxlint、Oxfmt

主题偏好由 Zustand persist 保存到 localStorage。查询缓存仅保存在内存；查询与 mutation 不自动重试。会话、模型配置和审批记录由 AgentLoom 持久化。

当前提供起始页、404 页面与主题切换。登录、聊天、SSE、审批及模型管理页面尚未接入。

## API 代理与部署

开发时请求相对路径 /api/*，Vite 转发到 http://127.0.0.1:3000/*，去除 /api 前缀。例如 /api/auth/login 对应后端 /auth/login。配置位于 vite.config.ts；开发前需单独启动 AgentLoom。

生产部署需配置同源反向代理，将 /api/* 去除前缀后转发到后端，SSE 关闭缓冲并设置足够的读超时；其他应用路径回退到 index.html。Vite 开发代理不包含在构建产物中。

浏览器环境变量会进入公开产物，不得放入 JWT 签名密钥、数据库密码或模型 API Key。

## 常用命令

```sh
pnpm dev          # 开发
pnpm check        # 格式化、lint、核心测试、类型检查及生产构建
pnpm preview      # 本地预览构建产物
pnpm test:watch   # 测试监听
pnpm dlx shadcn@latest add dialog  # 按需添加组件
```

## 官方参考

- [Vite](https://vite.dev/guide/)
- [Tailwind CSS + Vite](https://tailwindcss.com/docs/installation/using-vite)
- [shadcn/ui + Vite](https://ui.shadcn.com/docs/installation/vite)
- [React Router](https://reactrouter.com/start/declarative/installation)
- [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/quick-start)
- [Zustand persist](https://zustand.docs.pmnd.rs/integrations/persisting-store-data)
- [Vitest](https://vitest.dev/guide/)
- [Oxlint](https://oxc.rs/docs/guide/usage/linter.html)
- [Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html)
