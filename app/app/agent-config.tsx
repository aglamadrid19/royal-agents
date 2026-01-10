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
import { useSignRawHash } from "@/src/privyExtendedChains";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { hashHostedConfig, hashRunnerConfig } from "@/src/lib/agentConfig";
import { requestNonce, setAgentConfig } from "@/src/lib/api";

const PROVIDER_NONE = 0;
const PROVIDER_XAI = 1;
const AGENT_TYPE_HOSTED = 1;
const AGENT_TYPE_RUNNER = 2;
const DEFAULT_TOOL_NAME = "generate_logo_svg";

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
  const agentTypeParam = useMemo(() => String(params.agentType || ""), [params.agentType]);
  const agentType = useMemo(() => {
    if (agentTypeParam === "2" || agentTypeParam === "runner") {
      return AGENT_TYPE_RUNNER;
    }
    if (agentTypeParam === "1" || agentTypeParam === "hosted") {
      return AGENT_TYPE_HOSTED;
    }
    return AGENT_TYPE_HOSTED;
  }, [agentTypeParam]);
  const usageFee = useMemo(() => Number(params.usageFee || 0), [params.usageFee]);
  const toolFee = useMemo(() => Number(params.toolFee || 0), [params.toolFee]);
  const toolCap = useMemo(() => Number(params.toolCap || 0), [params.toolCap]);

  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState("0.2");
  const [maxTokens, setMaxTokens] = useState("512");
  const [toolName, setToolName] = useState(DEFAULT_TOOL_NAME);
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
    if (!Number.isFinite(usageFee) || usageFee <= 0) {
      setStatus("Usage fee is invalid.");
      return;
    }
    const tempValue = Number(temperature);
    const maxTokenValue = Math.trunc(Number(maxTokens));
    if (agentType === AGENT_TYPE_HOSTED) {
      if (!Number.isFinite(tempValue) || tempValue < 0 || tempValue > 2) {
        setStatus("Temperature must be between 0 and 2.");
        return;
      }
      if (!Number.isFinite(maxTokenValue) || maxTokenValue <= 0) {
        setStatus("Max tokens must be a positive number.");
        return;
      }
    }
    if (agentType === AGENT_TYPE_RUNNER) {
      if (!toolName.trim()) {
        setStatus("Tool name is required.");
        return;
      }
      if (!Number.isFinite(toolFee) || toolFee <= 0 || !Number.isFinite(toolCap) || toolCap <= 0) {
        setStatus("Tool fee and cap must be set for runner agents.");
        return;
      }
    }

    setLoading(true);
    try {
      const provider = agentType === AGENT_TYPE_HOSTED ? PROVIDER_XAI : PROVIDER_NONE;
      const { hashBytes } =
        agentType === AGENT_TYPE_HOSTED
          ? hashHostedConfig({
              provider: "xai",
              model,
              systemPrompt,
              temperature: tempValue,
              maxTokens: maxTokenValue,
            })
          : hashRunnerConfig({
              systemPrompt,
              toolName,
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
          provider,
          agentType,
          hashBytes,
          usageFee,
          toolFee,
          toolCap,
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
        toolName: agentType === AGENT_TYPE_RUNNER ? toolName : undefined,
        signatureFormat: "hash",
      });

      setStatus("Config stored. Now set the agent key.");
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
        <Text style={styles.title}>
          {agentType === AGENT_TYPE_HOSTED ? "Configure Type 1 Agent" : "Configure Type 2 Agent"}
        </Text>
        <Text style={styles.note}>
          {agentType === AGENT_TYPE_HOSTED
            ? "Endpoint is fixed to xAI. Configure prompt and settings."
            : "Runner calls an MCP tool on the owner's machine."}
        </Text>
        <Text style={styles.label}>System Prompt</Text>
        <TextInput
          value={systemPrompt}
          onChangeText={setSystemPrompt}
          placeholder="You are SciGrok..."
          style={[styles.input, styles.multiline]}
          multiline
        />
        {agentType === AGENT_TYPE_HOSTED ? (
          <>
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
          </>
        ) : (
          <>
            <Text style={styles.label}>Tool Name</Text>
            <TextInput
              value={toolName}
              onChangeText={setToolName}
              placeholder={DEFAULT_TOOL_NAME}
              style={styles.input}
              autoCapitalize="none"
            />
          </>
        )}
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
