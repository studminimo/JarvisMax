import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { zonedDateKey } from "@/domain/time";

export function useTodayKey(): string {
  const [todayKey, setTodayKey] = useState(() => zonedDateKey(new Date()));

  useEffect(() => {
    const refresh = () => {
      const next = zonedDateKey(new Date());
      setTodayKey((current) => (current === next ? current : next));
    };
    const timer = setInterval(refresh, 30_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refresh();
      }
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  return todayKey;
}
