import { useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { requestNonce, setAgentKey } from "@/src/lib/api";
import { useMovementAccount } from "@/hooks/useMovementAccount";
import { useSignRawHash } from "@privy-io/expo/extended-chains";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

export default function SetKeyScreen() {
  const { activeWallet, isCreatingWallet } = useMovementAccount();
  const { signRawHash } = useSignRawHash();
  const [agentId, setAgentId] = useState("");
  const [provider, setProvider] = useState<"openai" | "anthropic">("openai");
  const [apiKey, setApiKey] = useState("");
  const [payoutAddress, setPayoutAddress] = useState("");
  const [nonce, setNonce] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const request = async () => {
    setLoading(true);
    setStatus(null);
    try {
      if (!activeWallet) {
        setStatus("Connect your Movement wallet first.");
        return;
      }
      const data = await requestNonce(activeWallet.address);
      setNonce(data.nonce);
      setStatus("Nonce issued. Submit to sign with your wallet.");
    } catch (err: any) {
      setStatus(err.message || "Failed to request nonce");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    setLoading(true);
    setStatus(null);
    try {
      if (!activeWallet) {
        setStatus("Connect your Movement wallet first.");
        return;
      }
      if (!nonce) {
        setStatus("Request a nonce first.");
        return;
      }
      const message = new TextEncoder().encode(`RoyalAgents nonce: ${nonce}`);
      const hashHex = `0x${bytesToHex(sha256(message))}`;
      const { signature } = await signRawHash({
        address: activeWallet.address,
        chainType: "aptos",
        hash: hashHex,
      });
      await setAgentKey({
        agentId: Number(agentId),
        address: activeWallet.address,
        publicKey: activeWallet.public_key,
        signature,
        nonce,
        provider,
        apiKey,
        payoutAddress,
        signatureFormat: "hash",
      });
      setStatus("Key stored. Now set key_status on-chain.");
    } catch (err: any) {
      setStatus(err.message || "Failed to set key");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Set / Update API Key</Text>
        <Text style={styles.label}>Agent ID</Text>
        <TextInput
          value={agentId}
          onChangeText={setAgentId}
          placeholder="1"
          keyboardType="numeric"
          style={styles.input}
        />
        <Text style={styles.label}>Wallet Address</Text>
        <TextInput value={activeWallet?.address || ""} editable={false} style={styles.input} />
        <Text style={styles.label}>Wallet Public Key</Text>
        <TextInput value={activeWallet?.public_key || ""} editable={false} style={styles.input} />
        {isCreatingWallet ? (
          <Text style={styles.note}>Creating your Movement wallet...</Text>
        ) : null}
        <Text style={styles.label}>Provider</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.toggle, provider === "openai" && styles.toggleActive]}
            onPress={() => setProvider("openai")}
          >
            <Text style={styles.toggleText}>OpenAI</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggle, provider === "anthropic" && styles.toggleActive]}
            onPress={() => setProvider("anthropic")}
          >
            <Text style={styles.toggleText}>Anthropic</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.label}>API Key</Text>
        <TextInput
          value={apiKey}
          onChangeText={setApiKey}
          placeholder="sk-..."
          style={styles.input}
          autoCapitalize="none"
        />
        <Text style={styles.label}>Payout Address (EVM)</Text>
        <TextInput
          value={payoutAddress}
          onChangeText={setPayoutAddress}
          placeholder="0x..."
          style={styles.input}
          autoCapitalize="none"
        />
        <Text style={styles.label}>Nonce</Text>
        <TextInput value={nonce} editable={false} style={styles.input} />
        <TouchableOpacity style={styles.button} onPress={request} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={styles.buttonText}>Request Nonce</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={submit} disabled={loading}>
          <Text style={styles.secondaryButtonText}>Submit Key</Text>
        </TouchableOpacity>
        {status ? <Text style={styles.status}>{status}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0f1a" },
  container: { padding: 20, gap: 12 },
  title: { color: "#f8fafc", fontSize: 18, fontWeight: "600" },
  label: { color: "#94a3b8", fontSize: 12 },
  input: {
    backgroundColor: "#0b1222",
    borderRadius: 12,
    padding: 12,
    color: "#e2e8f0",
    borderColor: "#1f2a40",
    borderWidth: 1,
  },
  row: { flexDirection: "row", gap: 10 },
  toggle: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderColor: "#1f2a40",
    borderWidth: 1,
    alignItems: "center",
  },
  toggleActive: { backgroundColor: "#1e293b" },
  toggleText: { color: "#e2e8f0" },
  button: {
    backgroundColor: "#7dd3fc",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: { color: "#0f172a", fontWeight: "600" },
  secondaryButton: {
    borderColor: "#7dd3fc",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#7dd3fc", fontWeight: "600" },
  status: { color: "#cbd5f5" },
  note: { color: "#94a3b8", fontSize: 12 },
});
