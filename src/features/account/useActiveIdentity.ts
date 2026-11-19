import { useBoard } from "@/features/board/BoardProvider";
import { PRODUCT_TIME_ZONE } from "@/domain/time";

import { useAccount } from "./AccountProvider";

/** Le profil distant prime dès qu’il est chargé. Sinon, le prénom reste celui de l’ouverture. */
export function useActiveIdentity(): { givenName: string; timeZone: string } {
  const { status } = useAccount();
  const { board } = useBoard();
  if (status.kind === "signed_in") {
    return {
      givenName: status.profile.givenName,
      timeZone: status.profile.timeZone,
    };
  }
  return { givenName: board.givenName, timeZone: PRODUCT_TIME_ZONE };
}
