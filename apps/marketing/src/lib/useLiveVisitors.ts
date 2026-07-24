"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "./supabaseBrowser";

// Mirrors apps/app/src/hooks/useLiveVisitors.ts, using the client-side
// Supabase client instead of the server one.
export function useLiveVisitors() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const channel = supabaseBrowser.channel("live-visitors", {
      config: { presence: { key: crypto.randomUUID() } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });
    return () => { void supabaseBrowser.removeChannel(channel); };
  }, []);
  return count;
}
