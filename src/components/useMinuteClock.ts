import { useEffect, useState } from "react";
import { AppState } from "react-native";

export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const arm = () => {
      if (timer) {
        clearTimeout(timer);
      }
      const current = new Date();
      setNow(current);
      const msUntilNextMinute = (60 - current.getSeconds()) * 1000 - current.getMilliseconds() + 50;
      timer = setTimeout(arm, Math.max(msUntilNextMinute, 250));
    };

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        arm();
        return;
      }
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    });

    arm();

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      subscription.remove();
    };
  }, []);

  return now;
}
