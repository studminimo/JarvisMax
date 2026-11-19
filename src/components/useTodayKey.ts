import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { PRODUCT_TIME_ZONE, zonedDateKey } from "@/domain/time";

export function useTodayKey(timeZone = PRODUCT_TIME_ZONE): string {
  const [zone, setZone] = useState(timeZone);
  const [todayKey, setTodayKey] = useState(() => zonedDateKey(new Date(), timeZone));
  if (zone !== timeZone) {
    setZone(timeZone);
    setTodayKey(zonedDateKey(new Date(), timeZone));
  }

  useEffect(() => {
    const refresh = () => {
      const next = zonedDateKey(new Date(), timeZone);
      setTodayKey((current) => (current === next ? current : next));
    };
    refresh();
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
  }, [timeZone]);

  return todayKey;
}
