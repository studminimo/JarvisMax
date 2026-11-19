import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

import { AppText } from "@/components/AppText";
import { Card } from "@/components/Card";
import { TextButton } from "@/components/TextButton";

import { speakText } from "../voice/speech";

const CHOICES = [5, 15, 25] as const;

export function MinuteTimer() {
  const [left, setLeft] = useState<number | null>(null);
  const spoken = useRef(false);

  useEffect(() => {
    if (left === null || left <= 0) {
      return;
    }
    const timer = setTimeout(() => setLeft((current) => (current === null ? null : current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  useEffect(() => {
    if (left === 0 && !spoken.current) {
      spoken.current = true;
      speakText("C’est l’heure.");
    }
    if (left !== 0) {
      spoken.current = false;
    }
  }, [left]);

  const label = left === null ? "Choisis une durée." : left === 0 ? "C’est l’heure." : `${Math.floor(left / 60)} min ${String(left % 60).padStart(2, "0")}`;

  return (
    <Card title="Minuteur">
      <AppText variant={left === 0 ? "body" : "muted"}>{label}</AppText>
      <View>
        {left === null || left === 0
          ? CHOICES.map((minutes) => (
              <TextButton
                key={minutes}
                label={`${minutes} min`}
                onPress={() => {
                  spoken.current = false;
                  setLeft(minutes * 60);
                }}
              />
            ))
          : (
              <TextButton label="Arrêter" onPress={() => setLeft(null)} />
            )}
      </View>
    </Card>
  );
}
