import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Constants from "expo-constants";
import { useMovementAccount } from "@/hooks/useMovementAccount";
import { useMovementWallet } from "@/hooks/useMovement";
import { useSignRawHash } from "@privy-io/expo/extended-chains";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { hashConfig } from "@/src/lib/agentConfig";
import { requestNonce, setAgentConfig } from "@/src/lib/api";

const PROVIDER_XAI = 1;

export default function AgentConfigScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { activeWallet } = useMovementAccount();
  const { signAndSubmitTransaction } = useMovementWallet();
  const { signRawHash } = useSignRawHash();
  const packageAddress = (Constants.expoConfig?.extra?.movePackageAddress as string) || "";

  const name = useMemo(() => String(params.name || ""), [params.name]);
  const description = useMemo(() => String(params.description || ""), [params.description]);
  const model = useMemo(() => String(params.model || ""), [params.model]);
  const metadataUri = useMemo(() => String(params.metadataUri || ""), [params.metadataUri]);
  const usageFee = useMemo(() => String(params.usageFee || ""), [params.usageFee]);

  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState("0.2");
  const [maxTokens, setMaxTokens] = useState("512");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const submit = async () => {
    setStatus(null);
    if (!activeWallet) {
      setStatus("Connect your Movement wallet first.");
      return;
    }
    if (!packageAddress) {
      setStatus("Missing movePackageAddress in app.json.");
      return;
    }
    if (!name || !description || !model) {
      setStatus("Missing agent metadata from the previous step.");
      return;
    }
    if (!systemPrompt.trim()) {
      setStatus("System prompt is required.");
      return;
    }
    const parsedFee = Number(usageFee);
    if (!Number.isFinite(parsedFee) || parsedFee <= 0) {
      setStatus("Usage fee is invalid.");
      return;
    }
    const tempValue = Number(temperature);
    const maxTokenValue = Math.trunc(Number(maxTokens));
    if (!Number.isFinite(tempValue) || tempValue < 0 || tempValue > 2) {
      setStatus("Temperature must be between 0 and 2.");
      return;
    }
    if (!Number.isFinite(maxTokenValue) || maxTokenValue <= 0) {
      setStatus("Max tokens must be a positive number.");
      return;
    }

    setLoading(true);
    try {
      const { hashBytes } = hashConfig({
        provider: "xai",
        model,
        systemPrompt,
        temperature: tempValue,
        maxTokens: maxTokenValue,
      });

      const mintResult = await signAndSubmitTransaction(
        activeWallet.public_key,
        activeWallet.address,
        `${packageAddress}::agent_nft::mint_agent`,
        [],
        [
          metadataUri,
          name,
          description,
          model,
          PROVIDER_XAI,
          hashBytes,
          parsedFee,
        ]
      );

      const mintedAgentId = mintResult.agentId;
      if (mintedAgentId === undefined || mintedAgentId === null) {
        setStatus("Minted. Use the agent_id from events to finish config.");
        return;
      }

      const nonceRes = await requestNonce(activeWallet.address);
      const message = new TextEncoder().encode(`RoyalAgents nonce: ${nonceRes.nonce}`);
      const hashHex = `0x${bytesToHex(sha256(message))}`;
      const { signature } = await signRawHash({
        address: activeWallet.address,
        chainType: "aptos",
        hash: hashHex,
      });

      await setAgentConfig({
        agentId: Number(mintedAgentId),
        address: activeWallet.address,
        publicKey: activeWallet.public_key,
        signature,
        nonce: nonceRes.nonce,
        systemPrompt,
        temperature: tempValue,
        maxTokens: maxTokenValue,
        signatureFormat: "hash",
      });

      setStatus("Config stored. Now set the API key.");
      router.push({ pathname: "/set-key", params: { agentId: String(mintedAgentId) } });
    } catch (err: any) {
      setStatus(err.message || "Failed to configure agent.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Configure Type 1 Agent</Text>
        <Text style={styles.note}>Endpoint is fixed to xAI. Configure prompt and settings.</Text>
        <Text style={styles.label}>System Prompt</Text>
        <TextInput
          value={systemPrompt}
          onChangeText={setSystemPrompt}
          placeholder="You are SciGrok..."
          style={[styles.input, styles.multiline]}
          multiline
        />
        <Text style={styles.label}>Temperature</Text>
        <TextInput
          value={temperature}
          onChangeText={setTemperature}
          placeholder="0.2"
          keyboardType="numeric"
          style={styles.input}
        />
        <Text style={styles.label}>Max Tokens</Text>
        <TextInput
          value={maxTokens}
          onChangeText={setMaxTokens}
          placeholder="512"
          keyboardType="numeric"
          style={styles.input}
        />
        <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={styles.buttonText}>Mint Agent + Save Config</Text>
          )}
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
  note: { color: "#94a3b8", fontSize: 12 },
  label: { color: "#94a3b8", fontSize: 12 },
  input: {
    backgroundColor: "#0b1222",
    borderRadius: 12,
    padding: 12,
    color: "#e2e8f0",
    borderColor: "#1f2a40",
    borderWidth: 1,
  },
  multiline: { minHeight: 120, textAlignVertical: "top" },
  button: {
    backgroundColor: "#7dd3fc",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#0f172a", fontWeight: "600" },
  status: { color: "#cbd5f5" },
});
