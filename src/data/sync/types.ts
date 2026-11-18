/** Mutation locale en attente. La file d’écriture sera branchée avec les tâches, à l’étape 4. */
export type SyncOperation = "insert" | "update" | "delete";

export type OutboxEntry = {
  id: string;
  entity: string;
  operation: SyncOperation;
  updatedAt: string;
};
