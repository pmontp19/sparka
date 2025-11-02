"use client";

// Hooks that are used to mutate the chat store via tRPC mutations for authenticated users

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import type { ChatMessage } from "@/lib/ai/types";
import type { Document } from "@/lib/db/schema";
import {
  chatMessageToDbMessage,
  dbMessageToChatMessage,
} from "@/lib/message-conversion";
import type { UIChat } from "@/lib/types/uiChat";
import { generateUUID, getTextContentFromMessage } from "@/lib/utils";
import { useChatId } from "@/providers/chat-id-provider";
import { useTRPC } from "@/trpc/react";

export function useSaveChat() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const generateTitleMutation = useMutation(
    trpc.chat.generateTitle.mutationOptions({
      onError: (error) => {
        console.error("Failed to generate title:", error);
      },
    })
  );

  const saveChatMutation = useMutation({
    mutationFn: async ({
      chatId,
      message,
    }: {
      chatId: string;
      message: string;
    }) => {
      // Save chat with temporary title first
      const tempChat = {
        id: chatId,
        title: "Untitled",
        createdAt: new Date(),
        updatedAt: new Date(),
        visibility: "private" as const,
      };

      await saveAnonymousChatToStorage({ ...tempChat, isPinned: false });
      return { tempChat, message };
    },
    onSuccess: async ({ tempChat, message }) => {
      // Generate proper title asynchronously after successful save
      const data = await generateTitleMutation.mutateAsync({ message });
      if (data?.title) {
        // Update the chat with the generated title
        await saveAnonymousChatToStorage({
          ...tempChat,
          title: data.title,
          isPinned: false,
        });

        // Invalidate chats to refresh the UI
        queryClient.invalidateQueries({
          queryKey: trpc.chat.getAllChats.queryKey(),
        });
      }
    },
    onError: (error) => {
      console.error("Failed to save chat:", error);
      toast.error("Failed to save chat");
    },
  });

  const saveChat = useCallback(
    (chatId: string, message: string, isAuthenticated: boolean) => {
      // Skip if authenticated (API handles it)
      if (isAuthenticated) {
        return;
      }

      return saveChatMutation.mutate({ chatId, message });
    },
    [saveChatMutation]
  );

  return {
    saveChat,
    isSaving: saveChatMutation.isPending,
    isGeneratingTitle: generateTitleMutation.isPending,
  };
}

export function useGetChatMessagesQueryOptions() {
  const trpc = useTRPC();
  const { id: chatId, type } = useChatId();
  const baseQueryOptions = trpc.chat.getChatMessages.queryOptions({
    chatId: chatId || "",
  });

  const getMessagesByChatIdQueryOptions = useMemo(
    () => ({
      ...baseQueryOptions,
      enabled: !!chatId && type === "chat",
    }),
    [baseQueryOptions, chatId, type]
  );

  return getMessagesByChatIdQueryOptions;
}

export function useMessagesQuery() {
  const options = useGetChatMessagesQueryOptions();

  return options;
}

type ChatMutationOptions = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};
export function useDeleteChat() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const getAllChatsQueryKey = useMemo(
    () => trpc.chat.getAllChats.queryKey(),
    [trpc.chat.getAllChats]
  );

  const deleteChatMutationOptions = useMemo(
    () => trpc.chat.deleteChat.mutationOptions(),
    [trpc.chat.deleteChat]
  );

  const deleteMutation = useMutation({
    ...deleteChatMutationOptions,
    onMutate: async ({ chatId }: { chatId: string }) => {
      await qc.cancelQueries({ queryKey: getAllChatsQueryKey });
      const previousChats = qc.getQueryData<UIChat[]>(getAllChatsQueryKey);
      qc.setQueryData<UIChat[]>(
        getAllChatsQueryKey,
        (old) => old?.filter((c) => c.id !== chatId) ?? old
      );
      return { previousChats } as { previousChats?: UIChat[] };
    },
    onError: (_err, _vars, ctx) => {
      if ((ctx as { previousChats?: UIChat[] } | undefined)?.previousChats) {
        qc.setQueryData(
          getAllChatsQueryKey,
          (ctx as { previousChats?: UIChat[] }).previousChats
        );
      }
    },
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: getAllChatsQueryKey });
    },
  });

  const deleteChat = useCallback(
    async (chatId: string, options?: ChatMutationOptions) => {
      try {
        await deleteMutation.mutateAsync({ chatId });
        options?.onSuccess?.();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error : new Error("Unknown error");
        options?.onError?.(errorMessage);
        throw errorMessage;
      }
    },
    [deleteMutation]
  );

  return { deleteChat };
}

export function useRenameChat() {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const getAllChatsQueryKey = useMemo(
    () => trpc.chat.getAllChats.queryKey(),
    [trpc.chat.getAllChats]
  );

  const renameChatMutationOptions = useMemo(
    () => trpc.chat.renameChat.mutationOptions(),
    [trpc.chat.renameChat]
  );

  const renameMutation = useMutation({
    ...renameChatMutationOptions,
    onMutate: async ({ chatId, title }: { chatId: string; title: string }) => {
      await queryClient.cancelQueries({ queryKey: getAllChatsQueryKey });
      const previousChats =
        queryClient.getQueryData<UIChat[]>(getAllChatsQueryKey);
      queryClient.setQueryData<UIChat[]>(getAllChatsQueryKey, (old) => {
        if (!old) {
          return old;
        }
        return old.map((c) => (c.id === chatId ? { ...c, title } : c));
      });
      return { previousChats } as { previousChats?: UIChat[] };
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { previousChats?: UIChat[] } | undefined;
      if (ctx?.previousChats) {
        queryClient.setQueryData(getAllChatsQueryKey, ctx.previousChats);
      }
      toast.error("Failed to rename chat");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: getAllChatsQueryKey });
    },
  });

  return renameMutation;
}

export function usePinChat() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const getAllChatsQueryKey = useMemo(
    () => trpc.chat.getAllChats.queryKey(),
    [trpc.chat.getAllChats]
  );

  const setIsPinnedMutationOptions = useMemo(
    () => trpc.chat.setIsPinned.mutationOptions(),
    [trpc.chat.setIsPinned]
  );

  const pinMutation = useMutation({
    ...setIsPinnedMutationOptions,
    onMutate: async ({
      chatId,
      isPinned,
    }: {
      chatId: string;
      isPinned: boolean;
    }) => {
      await queryClient.cancelQueries({ queryKey: getAllChatsQueryKey });
      const previousChats =
        queryClient.getQueryData<UIChat[]>(getAllChatsQueryKey);
      queryClient.setQueryData<UIChat[]>(getAllChatsQueryKey, (old) => {
        if (!old) {
          return old;
        }
        return old.map((c) => (c.id === chatId ? { ...c, isPinned } : c));
      });
      return { previousChats } as { previousChats?: UIChat[] };
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { previousChats?: UIChat[] } | undefined;
      if (ctx?.previousChats) {
        queryClient.setQueryData(getAllChatsQueryKey, ctx.previousChats);
      }
      toast.error("Failed to pin chat");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: getAllChatsQueryKey });
    },
  });

  return pinMutation;
}

export function useDeleteTrailingMessages() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const deleteTrailingMutationOptions = useMemo(
    () => trpc.chat.deleteTrailingMessages.mutationOptions(),
    [trpc.chat.deleteTrailingMessages]
  );

  const invalidateMessagesByChatId = useCallback(
    (chatId: string) => {
      queryClient.invalidateQueries({
        queryKey: trpc.chat.getChatMessages.queryKey({ chatId }),
      });
    },
    [queryClient, trpc.chat.getChatMessages]
  );

  // Delete trailing messages mutation
  const deleteTrailingMessagesMutation = useMutation({
    ...deleteTrailingMutationOptions,
    onMutate: async ({
      messageId,
      chatId,
    }: {
      messageId: string;
      chatId: string;
    }) => {
      const messagesQueryKey = trpc.chat.getChatMessages.queryKey({ chatId });
      await queryClient.cancelQueries({ queryKey: messagesQueryKey });
      const previousMessages =
        queryClient.getQueryData<ChatMessage[]>(messagesQueryKey);
      queryClient.setQueryData<ChatMessage[] | undefined>(
        messagesQueryKey,
        (old) => {
          if (!old) {
            return old;
          }
          const messageIndex = old.findIndex((msg) => msg.id === messageId);
          if (messageIndex === -1) {
            return old;
          }
          return old.slice(0, messageIndex);
        }
      );
      return { previousMessages, messagesQueryKey } as {
        previousMessages?: ChatMessage[];
        messagesQueryKey: unknown;
      };
    },
    onError: (_err, _vars, context) => {
      const ctx = context as {
        previousMessages?: ChatMessage[];
        messagesQueryKey: unknown;
      } | null;
      if (ctx?.previousMessages) {
        queryClient.setQueryData(
          ctx.messagesQueryKey as any,
          ctx.previousMessages
        );
      }
      toast.error("Failed to delete messages");
    },
    onSuccess: (_data, { chatId }: { chatId: string }) => {
      invalidateMessagesByChatId(chatId);
      toast.success("Messages deleted");
    },
  });

  return deleteTrailingMessagesMutation;
}

export function useCloneChat() {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const getAllChatsQueryKey = useMemo(
    () => trpc.chat.getAllChats.queryKey(),
    [trpc.chat.getAllChats]
  );

  const copyPublicChatMutationOptions = useMemo(
    () => trpc.chat.cloneSharedChat.mutationOptions(),
    [trpc.chat.cloneSharedChat]
  );

  return useDualMutation({
    ...copyPublicChatMutationOptions,
    shouldUseLocal: () => !isAuthenticated,
    localMutationFn: async ({ chatId }: { chatId: string }) => {
      const originalChat = queryClient.getQueryData(
        trpc.chat.getPublicChat.queryKey({ chatId })
      );
      const originalMessages = queryClient.getQueryData(
        trpc.chat.getPublicChatMessages.queryKey({ chatId })
      ) as ChatMessage[] | undefined;
      if (!(originalChat && originalMessages)) {
        throw new Error("Original chat data not found in cache");
      }
      const originalMessagesIds = originalMessages.map((m) => m.id);
      const allDocumentQueries = queryClient.getQueriesData({
        queryKey: trpc.document.getPublicDocuments
          .queryKey({ id: "" })
          .slice(0, -1),
      });
      const originalDocuments = allDocumentQueries
        .flatMap(([, data]) => (data as Document[] | undefined) ?? [])
        .filter((document: any) =>
          originalMessagesIds.includes(document.messageId)
        );
      const newId = generateUUID();
      await cloneAnonymousChat(
        originalMessages.map((message) =>
          chatMessageToDbMessage(message, chatId)
        ),
        originalChat,
        originalDocuments as Document[],
        newId
      );
      return { chatId: newId } as const;
    },
    onSettled: async () => {
      await queryClient.refetchQueries({ queryKey: getAllChatsQueryKey });
    },
    onError: (error) => {
      console.error("Failed to copy chat:", error);
    },
  });
}

export function useSaveMessageMutation() {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { saveChat: saveChatWithTitle } = useSaveChat();

  return useDualMutation({
    shouldUseLocal: () => !isAuthenticated,
    mutationFn: async ({
      message: _message,
      chatId: _chatId,
    }: {
      message: ChatMessage;
      chatId: string;
    }) => {
      // Posting chats persists via server side; local cache updates handled in onMutateAction
      return { success: true } as const;
    },
    localMutationFn: async ({
      message,
      chatId,
    }: {
      message: ChatMessage;
      chatId: string;
    }) => {
      await saveAnonymousMessage(chatMessageToDbMessage(message, chatId));
      return { success: true } as const;
    },
    onMutate: async ({ message, chatId }) => {
      const messagesQueryKey = trpc.chat.getChatMessages.queryKey({ chatId });
      await queryClient.cancelQueries({ queryKey: messagesQueryKey });
      const previousMessages =
        queryClient.getQueryData<ChatMessage[]>(messagesQueryKey);
      queryClient.setQueryData<ChatMessage[]>(messagesQueryKey, (old) => {
        if (!old) {
          return [message];
        }
        return [...old, message];
      });
      return { previousMessages, messagesQueryKey } as const;
    },
    onError: (err, _vars, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          context.messagesQueryKey,
          context.previousMessages
        );
      }
      console.error("Failed to save message:", err);
      toast.error("Failed to save message");
    },
    onSuccess: (_data, { message, chatId }, _ctx) => {
      if (isAuthenticated) {
        if (message.role === "assistant") {
          queryClient.invalidateQueries({
            queryKey: trpc.credits.getAvailableCredits.queryKey(),
          });
        }
      } else {
        const messagesQueryKey = trpc.chat.getChatMessages.queryKey({ chatId });
        const messages =
          queryClient.getQueryData<ChatMessage[]>(messagesQueryKey);
        if ((messages?.length ?? 0) === 1) {
          saveChatWithTitle(
            chatId,
            getTextContentFromMessage(message),
            isAuthenticated
          );
        }
      }
      if (message.role === "assistant") {
        queryClient.invalidateQueries({
          queryKey: trpc.chat.getAllChats.queryKey(),
        });
      }
    },
  });
}

export function useSetVisibility() {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const getAllChatsQueryKey = useMemo(
    () => trpc.chat.getAllChats.queryKey(),
    [trpc.chat.getAllChats]
  );

  const setVisibilityMutationOptions = useMemo(
    () => trpc.chat.setVisibility.mutationOptions(),
    [trpc.chat.setVisibility]
  );

  return useDualMutation({
    ...setVisibilityMutationOptions,
    shouldUseLocal: () => !isAuthenticated,
    localMutationFn: async ({
      chatId,
      visibility,
    }: {
      chatId: string;
      visibility: "private" | "public";
    }) => {
      const chat = await loadAnonymousChatById(chatId);
      if (!chat) {
        throw new Error("Chat not found");
      }
      await saveAnonymousChatToStorage({ ...chat, visibility });
      return { success: true } as const;
    },
    onError: () => {
      toast.error("Failed to update chat visibility");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: getAllChatsQueryKey });
    },
    onSuccess: (
      _data,
      variables: { chatId: string; visibility: "private" | "public" }
    ) => {
      const message =
        variables.visibility === "public"
          ? "Chat is now public - anyone with the link can access it"
          : "Chat is now private - only you can access it";
      toast.success(message);
    },
  });
}

export function useSaveDocument(
  _documentId: string,
  messageId: string,
  options?: {
    onSettled?: (result: any, error: any, params: any) => void;
  }
) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const isAuthenticated = !!session?.user;
  const anonymousSession = getAnonymousSession();

  const saveDocumentMutationOptions = useMemo(
    () => trpc.document.saveDocument.mutationOptions(),
    [trpc.document.saveDocument]
  );

  return useDualMutation({
    ...saveDocumentMutationOptions,
    shouldUseLocal: () => !isAuthenticated,
    localMutationFn: async (newDocument: {
      id: string;
      title: string;
      content: string;
      kind: Document["kind"];
    }) => {
      const documentToSave = {
        id: newDocument.id,
        createdAt: new Date(),
        title: newDocument.title,
        content: newDocument.content,
        kind: newDocument.kind,
        userId: anonymousSession?.id || "",
        messageId,
      } satisfies Document;
      await saveAnonymousDocument(documentToSave);
      return { success: true } as const;
    },
    onMutate: async (newDocument: {
      id: string;
      title: string;
      content: string;
      kind: Document["kind"];
    }) => {
      const queryKey = trpc.document.getDocuments.queryKey({
        id: newDocument.id,
      });
      await queryClient.cancelQueries({ queryKey });
      const previousDocuments =
        queryClient.getQueryData<Document[]>(queryKey) ?? [];
      const optimisticData: Document[] = [
        ...previousDocuments,
        {
          id: newDocument.id,
          createdAt: new Date(),
          title: newDocument.title,
          content: newDocument.content,
          kind: newDocument.kind as Document["kind"],
          userId: isAuthenticated ? userId || "" : anonymousSession?.id || "",
          messageId,
        } as Document,
      ];
      queryClient.setQueryData(queryKey, optimisticData);
      return { previousDocuments, newDocument } as {
        previousDocuments: Document[];
        newDocument: { id: string };
      };
    },
    onError: (_err, newDocument, context) => {
      const ctx = context as { previousDocuments?: Document[] } | undefined;
      if (ctx?.previousDocuments) {
        const queryKey = trpc.document.getDocuments.queryKey({
          id: (newDocument as { id: string }).id,
        });
        queryClient.setQueryData(queryKey, ctx.previousDocuments);
      }
    },
    onSettled: (result, error, params) => {
      queryClient.invalidateQueries({
        queryKey: trpc.document.getDocuments.queryKey({
          id: (params as any).id,
        }),
      });
      options?.onSettled?.(result, error, params);
    },
  });
}

export function useDocuments(id: string, disable: boolean) {
  const trpc = useTRPC();
  const { type } = useChatId();
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  const documentsQueryOptions = useDualQueryOptions({
    ...(type === "shared"
      ? trpc.document.getPublicDocuments.queryOptions({ id })
      : trpc.document.getDocuments.queryOptions({ id })),
    localQueryFn:
      type !== "shared"
        ? async () => await loadAnonymousDocumentsByDocumentId(id || "")
        : undefined,
    shouldUseLocal: () => type !== "shared" && !isAuthenticated,
    enabled: !disable && !!id,
  });

  return useQuery(documentsQueryOptions);
}

export function useGetAllChats(limit?: number) {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const trpc = useTRPC();
  const getAllChatsQueryOptions = useDualQueryOptions({
    ...trpc.chat.getAllChats.queryOptions(),
    localQueryFn: async () => {
      const chats = await loadAnonymousChatsFromStorage();
      return chats.map(
        (chat) =>
          ({
            id: chat.id,
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt || chat.createdAt,
            title: chat.title,
            visibility: chat.visibility,
            userId: "",
            isPinned: chat.isPinned,
          }) satisfies UIChat
      );
    },
    shouldUseLocal: () => !isAuthenticated,
    select: limit ? (data: UIChat[]) => data.slice(0, limit) : undefined,
  });

  return useQuery(getAllChatsQueryOptions);
}

export function useGetChatByIdQueryOptions(chatId: string) {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const trpc = useTRPC();
  const baseQueryOptions = trpc.chat.getChatById.queryOptions({ chatId });

  const getChatByIdQueryOptions = useMemo(
    () => ({
      ...baseQueryOptions,
      ...(isAuthenticated
        ? {}
        : {
            queryFn: async () => {
              const chat = await loadAnonymousChatById(chatId);
              if (!chat) {
                throw new Error("Chat not found");
              }
              return chat;
            },
          }),
      enabled: !!chatId,
    }),
    [baseQueryOptions, isAuthenticated, chatId]
  );

  return getChatByIdQueryOptions;
}

export function useGetChatById(chatId: string) {
  const options = useGetChatByIdQueryOptions(chatId);
  return useQuery(options);
}

export function useGetCredits() {
  const trpc = useTRPC();

  const { data: creditsData, isLoading: isLoadingCredits } = useQuery(
    trpc.credits.getAvailableCredits.queryOptions()
  );

  return {
    credits: (creditsData as { totalCredits: number } | undefined)
      ?.totalCredits,
    isLoadingCredits,
  };
}
