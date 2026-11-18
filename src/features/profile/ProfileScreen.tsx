import Constants from "expo-constants";

import { AppText } from "@/components/AppText";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { PRODUCT_TIME_ZONE } from "@/domain/time";

export function ProfileScreen() {
  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <Screen>
      <AppText variant="overline">Compte</AppText>
      <AppText accessibilityRole="header" variant="title">
        Profil
      </AppText>
      <Card title="Identité">
        <AppText variant="muted">Aucun compte n’est connecté.</AppText>
      </Card>
      <Card delay={40} title="Affichage">
        <AppText variant="body">{PRODUCT_TIME_ZONE}</AppText>
        <AppText variant="muted">Fuseau utilisé pour l’horloge et le calendrier.</AppText>
      </Card>
      <Card delay={80} title="Application">
        <AppText variant="body">Version {version}</AppText>
      </Card>
    </Screen>
  );
}
