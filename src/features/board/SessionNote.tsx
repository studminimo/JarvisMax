import { AppText } from "@/components/AppText";

import { useBoard } from "./BoardProvider";

export function SessionNote({ about = "local" }: { about?: "local" | "tasks" }) {
  const { taskSync } = useBoard();
  if (about === "tasks" && taskSync === "account") {
    return null;
  }
  if (about === "tasks" && taskSync === "loading") {
    return <AppText variant="muted">Chargement des tâches.</AppText>;
  }
  if (about === "tasks" && taskSync === "unavailable") {
    return <AppText variant="muted">Les tâches ne sont pas disponibles.</AppText>;
  }
  return <AppText variant="muted">Conservé le temps de cette ouverture. Rien n’est envoyé.</AppText>;
}
