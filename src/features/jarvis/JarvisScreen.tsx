import { AppText } from "@/components/AppText";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";

export function JarvisScreen() {
  return (
    <Screen>
      <AppText variant="overline">Conversation</AppText>
      <AppText accessibilityRole="header" variant="title">
        Jarvis
      </AppText>
      <Card title="Disponibilité">
        <AppText variant="muted">
          Jarvis ne peut pas encore répondre. Les échanges apparaîtront ici.
        </AppText>
      </Card>
    </Screen>
  );
}
