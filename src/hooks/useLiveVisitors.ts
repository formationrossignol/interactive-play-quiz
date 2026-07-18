import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useLiveVisitors() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const channel = supabase.channel("live-visitors", {
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
    return () => { void supabase.removeChannel(channel); };
  }, []);
  return count;
}
