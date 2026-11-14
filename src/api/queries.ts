import { infiniteQueryOptions, mutationOptions, queryOptions } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { useSession } from "@/stores/session";
import { api } from "./endpoints";
import type {
  ConversationInput,
  CreateModelInput,
  CreateProviderInput,
  ExecutionOptions,
  SubmitApprovalsInput,
  UpdateModelInput,
  UpdateProviderInput,
} from "./types";

const accountKey = (userId: string | undefined) => ["account", userId] as const;
const conversationsKey = (userId: string | undefined) =>
  [...accountKey(userId), "conversations"] as const;

export const apiKeys = {
  account: accountKey,
  providers: (userId: string | undefined) => [...accountKey(userId), "providers"] as const,
  models: (userId: string | undefined) => [...accountKey(userId), "models"] as const,
  conversations: conversationsKey,
  conversation: (userId: string | undefined, id: string) =>
    [...conversationsKey(userId), "detail", id] as const,
};

function forAccount<T>(userId: string | undefined, run: () => Promise<T>): Promise<T> {
  if (!userId || useSession.getState().user?.id !== userId) {
    return Promise.reject(new DOMException("Session changed", "AbortError"));
  }
  return run();
}

export const apiQueries = {
  providers: (userId: string | undefined) =>
    queryOptions({
      queryKey: apiKeys.providers(userId),
      queryFn: ({ signal }) => forAccount(userId, () => api.providers.list({ signal })),
      enabled: !!userId,
    }),
  models: (userId: string | undefined) =>
    queryOptions({
      queryKey: apiKeys.models(userId),
      queryFn: ({ signal }) => forAccount(userId, () => api.models.list({ signal })),
      enabled: !!userId,
    }),
  conversations: (userId: string | undefined, limit = 20) =>
    infiniteQueryOptions({
      queryKey: [...conversationsKey(userId), "list", limit],
      initialPageParam: null as string | null,
      queryFn: ({ pageParam, signal }) =>
        forAccount(userId, () =>
          api.conversations.list(
            { limit, ...(pageParam === null ? {} : { cursor: pageParam }) },
            { signal },
          ),
        ),
      getNextPageParam: (page) => page.nextCursor ?? undefined,
      enabled: !!userId,
    }),
  conversation: (userId: string | undefined, id: string) =>
    queryOptions({
      queryKey: apiKeys.conversation(userId, id),
      queryFn: ({ signal }) => forAccount(userId, () => api.conversations.detail(id, { signal })),
      enabled: !!userId && !!id,
      staleTime: 0,
      refetchInterval: (query) => (query.state.data?.active ? 1_000 : false),
    }),
};

function refreshConversations(userId: string) {
  return queryClient.invalidateQueries({ queryKey: apiKeys.conversations(userId) });
}

function refreshConfiguration(userId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: apiKeys.providers(userId) }),
    queryClient.invalidateQueries({ queryKey: apiKeys.models(userId) }),
    refreshConversations(userId),
  ]);
}

export const apiMutations = {
  createProvider: (userId: string) =>
    mutationOptions({
      mutationFn: (input: CreateProviderInput) =>
        forAccount(userId, () => api.providers.create(input)),
      onSettled: () => refreshConfiguration(userId),
    }),
  updateProvider: (userId: string, id: string) =>
    mutationOptions({
      mutationFn: (input: UpdateProviderInput) =>
        forAccount(userId, () => api.providers.update(id, input)),
      onSettled: () => refreshConfiguration(userId),
    }),
  createModel: (userId: string) =>
    mutationOptions({
      mutationFn: (input: CreateModelInput) => forAccount(userId, () => api.models.create(input)),
      onSettled: () => refreshConfiguration(userId),
    }),
  updateModel: (userId: string, id: string) =>
    mutationOptions({
      mutationFn: (input: UpdateModelInput) =>
        forAccount(userId, () => api.models.update(id, input)),
      onSettled: () => refreshConfiguration(userId),
    }),
  createConversation: (userId: string) =>
    mutationOptions({
      mutationFn: () => forAccount(userId, () => api.conversations.create()),
      onSettled: () => refreshConversations(userId),
    }),
  closeConversation: (userId: string, id: string) =>
    mutationOptions({
      mutationFn: () => forAccount(userId, () => api.conversations.close(id)),
      onSettled: () => refreshConversations(userId),
    }),
  input: (userId: string, id: string, options?: ExecutionOptions) =>
    mutationOptions({
      mutationFn: (input: ConversationInput) =>
        forAccount(userId, () => api.conversations.input(id, input, options)),
      onSettled: () => refreshConversations(userId),
    }),
  continue: (userId: string, id: string, options?: ExecutionOptions) =>
    mutationOptions({
      mutationFn: () => forAccount(userId, () => api.conversations.continue(id, options)),
      onSettled: () => refreshConversations(userId),
    }),
  approve: (userId: string, id: string, options?: ExecutionOptions) =>
    mutationOptions({
      mutationFn: (input: SubmitApprovalsInput) =>
        forAccount(userId, () => api.conversations.approve(id, input, options)),
      onSettled: () => refreshConversations(userId),
    }),
};
