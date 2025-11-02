"use client";

import { Coins } from "lucide-react";
import { useGetCredits } from "@/hooks/chat-sync-hooks";

export function SidebarCredits() {
  const { credits, isLoadingCredits } = useGetCredits();

  if (isLoadingCredits) {
    return (
      <div className="rounded-lg bg-muted/50 px-4 py-3 text-muted-foreground text-sm">
        Loading credits...
      </div>
    );
  }

  const remaining = credits ?? 0;

  return (
    <div className="rounded-lg bg-muted/50 px-4 py-3 text-muted-foreground text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4" />
          <span>Credits remaining</span>
        </div>
        <span className="font-semibold">{remaining}</span>
      </div>
    </div>
  );
}
