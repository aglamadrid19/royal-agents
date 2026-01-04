import { useCallback } from "react";
import { useSignRawHash } from "@privy-io/expo/extended-chains";
import Constants from "expo-constants";

const API_BASE_URL =
  (Constants.expoConfig?.extra?.movementBackendUrl as string) ||
  "http://localhost:3000";

export function useMovementWallet() {
  const { signRawHash } = useSignRawHash();

  const signAndSubmitTransaction = useCallback(
    async (
      publicKey: string,
      walletAddress: string,
      func: string,
      typeArguments: string[] = [],
      functionArguments: any[] = []
    ) => {
      const hashResponse = await fetch(`${API_BASE_URL}/generate-hash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: walletAddress,
          function: func,
          typeArguments,
          functionArguments,
        }),
      });

      if (!hashResponse.ok) {
        throw new Error("Failed to generate transaction hash");
      }

      const { hash, rawTxnHex } = await hashResponse.json();

      const { signature } = await signRawHash({
        address: walletAddress,
        chainType: "aptos",
        hash,
      });

      const submitResponse = await fetch(`${API_BASE_URL}/submit-transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawTxnHex,
          publicKey,
          signature,
        }),
      });

      if (!submitResponse.ok) {
        throw new Error("Failed to submit signed transaction");
      }

      const result = await submitResponse.json();

      if (!result.success) {
        throw new Error(result.vmStatus || "Unknown transaction failure");
      }

      return result;
    },
    [signRawHash]
  );

  const getWalletBalance = useCallback(async (walletAddress: string) => {
    const res = await fetch(`${API_BASE_URL}/balance/${walletAddress}`);
    if (!res.ok) {
      throw new Error("Failed to fetch balance");
    }
    const { balance } = await res.json();
    return balance;
  }, []);

  const getAccountInfo = useCallback(async (walletAddress: string) => {
    const res = await fetch(`${API_BASE_URL}/account-info/${walletAddress}`);
    if (!res.ok) {
      throw new Error("Failed to fetch account info");
    }
    return res.json();
  }, []);

  const requestFaucet = useCallback(async (walletAddress: string, amount = 1000000000) => {
    const res = await fetch(`${API_BASE_URL}/faucet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: walletAddress, amount }),
    });

    if (!res.ok) {
      throw new Error("Faucet request failed");
    }

    return res.json();
  }, []);

  const viewFunction = useCallback(
    async (func: string, typeArguments: string[] = [], functionArguments: any[] = []) => {
      const res = await fetch(`${API_BASE_URL}/view`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          function: func,
          typeArguments,
          functionArguments,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to call view function");
      }

      const data = await res.json();
      return data.result;
    },
    []
  );

  return {
    signAndSubmitTransaction,
    getWalletBalance,
    getAccountInfo,
    requestFaucet,
    viewFunction,
  };
}
