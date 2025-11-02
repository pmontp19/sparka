"use client";

import { memo, useMemo } from "react";
import {
  ModelSelectorBase,
  type ModelSelectorBaseItem,
} from "@/components/model-selector-base";
import type { AppModelDefinition } from "@/lib/ai/app-models";
import {
  type AppModelId,
  chatModels,
  getAppModelDefinition,
} from "@/lib/ai/app-models";
import { cn } from "@/lib/utils";

export function PureModelSelector({
  selectedModelId,
  className,
  onModelChangeAction,
}: {
  selectedModelId: AppModelId;
  onModelChangeAction?: (modelId: AppModelId) => void;
  className?: string;
}) {
  const models: ModelSelectorBaseItem<AppModelId, AppModelDefinition>[] =
    useMemo(
      () =>
        chatModels.map((m) => {
          const def = getAppModelDefinition(m.id);
          return { id: m.id, definition: def, disabled: false };
        }),
      []
    );

  return (
    <ModelSelectorBase
      className={cn("w-fit md:px-2", className)}
      enableFilters
      models={models}
      onModelChange={onModelChangeAction}
      selectedModelId={selectedModelId}
    />
  );
}

export const ModelSelector = memo(
  PureModelSelector,
  (prevProps, nextProps) =>
    prevProps.selectedModelId === nextProps.selectedModelId &&
    prevProps.className === nextProps.className &&
    prevProps.onModelChangeAction === nextProps.onModelChangeAction
);
