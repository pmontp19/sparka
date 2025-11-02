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
import { useSession } from "@/providers/session-provider";
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
      message,
    }: {
      message: string;
    }) => {
      // Generate title for the chat
      const data = await generateTitleMutation.mutateAsync({ message });

      // Invalidate chats to refresh the UI
      queryClient.invalidateQueries({
        queryKey: trpc.chat.getAllChats.queryKey(),
      });

      return data;
    },
    onError: (error) => {
      console.error("Failed to save chat:", error);
      toast.error("Failed to save chat");
    },
  });

  const saveChat = useCallback(
    (message: string) => {
      return saveChatMutation.mutate({ message });
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
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const getAllChatsQueryKey = useMemo(
    () => trpc.chat.getAllChats.queryKey(),
    [trpc.chat.getAllChats]
  );

  const cloneChatMutationOptions = useMemo(
    () => trpc.chat.cloneSharedChat.mutationOptions(),
    [trpc.chat.cloneSharedChat]
  );

  return useMutation({
    ...cloneChatMutationOptions,
    onSettled: async () => {
      await queryClient.refetchQueries({ queryKey: getAllChatsQueryKey });
    },
    onError: (error) => {
      console.error("Failed to copy chat:", error);
    },
  });
}

export function useSaveMessageMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      message: _message,
      chatId: _chatId,
    }: {
      message: ChatMessage;
      chatId: string;
    }) => {
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
    onSuccess: (_data, { message }) => {
      if (message.role === "assistant") {
        queryClient.invalidateQueries({
          queryKey: trpc.credits.getAvailableCredits.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.chat.getAllChats.queryKey(),
        });
      }
    },
  });
}

export function useSetVisibility() {
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

  return useMutation({
    ...setVisibilityMutationOptions,
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

  const saveDocumentMutationOptions = useMemo(
    () => trpc.document.saveDocument.mutationOptions(),
    [trpc.document.saveDocument]
  );

  return useMutation({
    ...saveDocumentMutationOptions,
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
          userId: userId || "",
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

  const queryOptions = useMemo(
    () =>
      type === "shared"
        ? trpc.document.getPublicDocuments.queryOptions({ id })
        : trpc.document.getDocuments.queryOptions({ id }),
    [type, trpc.document, id]
  );

  return useQuery({
    ...queryOptions,
    enabled: !disable && !!id,
  });
}

export function useGetAllChats(limit?: number) {
  const trpc = useTRPC();
  const queryOptions = trpc.chat.getAllChats.queryOptions();

  return useQuery({
    ...queryOptions,
    select: limit ? (data: UIChat[]) => data.slice(0, limit) : undefined,
  });
}

export function useGetChatByIdQueryOptions(chatId: string) {
  const trpc = useTRPC();
  return useMemo(
    () => ({
      ...trpc.chat.getChatById.queryOptions({ chatId }),
      enabled: !!chatId,
    }),
    [trpc.chat.getChatById, chatId]
  );
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
