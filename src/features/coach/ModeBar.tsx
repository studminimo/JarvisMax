import { View } from "react-native";

import { AppText } from "@/components/AppText";
import { Card } from "@/components/Card";
import { TextButton } from "@/components/TextButton";
import { COACH_MODES, COACH_LABELS, coachLine, type CoachMode } from "@/domain/coach";

type Props = {
  mode: CoachMode;
  onChange: (mode: CoachMode) => void;
};

export function ModeBar({ mode, onChange }: Props) {
  return (
    <Card title="Mode">
      <AppText variant="body">{coachLine(mode)}</AppText>
      <View>
        {COACH_MODES.filter((item) => item !== mode).map((item) => (
          <TextButton key={item} label={COACH_LABELS[item]} onPress={() => onChange(item)} />
        ))}
      </View>
    </Card>
  );
}
