import { useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { usePrivy } from "@/src/privy";
import { useCreateWallet } from "@/src/privyExtendedChains";

export type MovementWallet = {
  address: string;
  public_key: string;
};

export function useMovementAccount() {
  const { user } = usePrivy();
  const { createWallet } = useCreateWallet();
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);

  const movementWallets = useMemo(() => {
    if (!user?.linked_accounts) return [];
    return user.linked_accounts.filter(
      (account: any) => account.type === "wallet" && account.chain_type === "aptos"
    );
  }, [user?.linked_accounts]);

  const activeWallet = useMemo(() => {
    return movementWallets[0] ?? null;
  }, [movementWallets]);

  useEffect(() => {
    const ensureWallet = async () => {
      if (Platform.OS === "web") {
        return;
      }
      if (user && movementWallets.length === 0 && !isCreatingWallet) {
        setIsCreatingWallet(true);
        try {
          await createWallet({ chainType: "aptos" });
        } catch (error) {
          console.warn("Failed to create Movement wallet:", error);
        } finally {
          setIsCreatingWallet(false);
        }
      }
    };
    ensureWallet();
  }, [user, movementWallets.length, createWallet, isCreatingWallet]);

  return {
    user,
    activeWallet,
    movementWallets,
    isCreatingWallet,
  };
}
