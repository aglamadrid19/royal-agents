import { useLocalSearchParams } from "expo-router";
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useState } from "react";
import Constants from "expo-constants";
import { useMovementAccount } from "@/hooks/useMovementAccount";
import { useMovementWallet } from "@/hooks/useMovement";

export default function MarketplaceScreen() {
  const { agentId } = useLocalSearchParams();
  const [agentIdInput, setAgentIdInput] = useState(String(agentId || ""));
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const { activeWallet } = useMovementAccount();
  const { signAndSubmitTransaction } = useMovementWallet();
  const packageAddress =
    (Constants.expoConfig?.extra?.movePackageAddress as string) || "";

  const listAgent = async () => {
    if (!activeWallet) {
      setStatus("Connect your Movement wallet first.");
      return;
    }
    if (!packageAddress) {
      setStatus("Missing movePackageAddress in app.json.");
      return;
    }
    const parsedAgentId = Number(agentIdInput);
    if (!Number.isFinite(parsedAgentId)) {
      setStatus("Enter a valid agent id.");
      return;
    }
    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setStatus("Enter a valid price in Octas.");
      return;
    }
    try {
      const result = await signAndSubmitTransaction(
        activeWallet.public_key,
        activeWallet.address,
        `${packageAddress}::marketplace::list`,
        [],
        [parsedAgentId, parsedPrice]
      );
      setStatus(`Listed. Tx: ${result.transactionHash}`);
    } catch (err: any) {
      setStatus(err.message || "Failed to list agent.");
    }
  };

  const buyAgent = async () => {
    if (!activeWallet) {
      setStatus("Connect your Movement wallet first.");
      return;
    }
    if (!packageAddress) {
      setStatus("Missing movePackageAddress in app.json.");
      return;
    }
    try {
      const parsedAgentId = Number(agentIdInput);
      if (!Number.isFinite(parsedAgentId)) {
        setStatus("Enter a valid agent id.");
        return;
      }
      const result = await signAndSubmitTransaction(
        activeWallet.public_key,
        activeWallet.address,
        `${packageAddress}::marketplace::buy`,
        [],
        [parsedAgentId]
      );
      setStatus(`Purchased. Tx: ${result.transactionHash}`);
    } catch (err: any) {
      setStatus(err.message || "Failed to buy agent.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Marketplace</Text>
        <Text style={styles.note}>
          Listing and buying are on-chain transactions. Use your wallet to call
          Marketplace::list and Marketplace::buy.
        </Text>
        <View style={styles.card}>
          <Text style={styles.label}>Agent ID</Text>
          <TextInput
            value={agentIdInput}
            onChangeText={setAgentIdInput}
            style={styles.input}
          />
          <Text style={styles.label}>List Price (Octas)</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="1.0"
            style={styles.input}
          />
          <TouchableOpacity style={styles.button} onPress={listAgent}>
            <Text style={styles.buttonText}>List Agent (wallet)</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Buy Agent</Text>
          <TouchableOpacity style={styles.button} onPress={buyAgent}>
            <Text style={styles.buttonText}>Buy (wallet)</Text>
          </TouchableOpacity>
        </View>
        {status ? <Text style={styles.status}>{status}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0f1a" },
  container: { padding: 20, gap: 12 },
  title: { color: "#f8fafc", fontSize: 18, fontWeight: "600" },
  note: { color: "#94a3b8", fontSize: 12 },
  card: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 16,
    borderColor: "#1f2a40",
    borderWidth: 1,
  },
  label: { color: "#94a3b8", fontSize: 12 },
  input: {
    backgroundColor: "#0b1222",
    borderRadius: 12,
    padding: 12,
    color: "#e2e8f0",
    borderColor: "#1f2a40",
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#7dd3fc",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: { color: "#0f172a", fontWeight: "600" },
  status: { color: "#cbd5f5" },
});
