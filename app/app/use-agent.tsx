import Constants from "expo-constants";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
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
import { useMovementAccount } from "@/hooks/useMovementAccount";
import { generateClientKeypair, decryptResponse } from "@/src/lib/crypto";
import { useSignRawHash } from "@/src/privyExtendedChains";
import { fetchAgent } from "@/src/lib/api";
import { formatMoveAmount } from "@/src/lib/move";
import * as Clipboard from "expo-clipboard";
import { SvgXml } from "react-native-svg";

export default function UseAgentScreen() {
  const { agentId } = useLocalSearchParams();
  const { activeWallet, isCreatingWallet } = useMovementAccount();
  const { signRawHash } = useSignRawHash();
  const [prompt, setPrompt] = useState("");
  const [paymentHeader, setPaymentHeader] = useState("");
  const [agent, setAgent] = useState<any>(null);
  const [toolBudget, setToolBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [svgXml, setSvgXml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const backendUrl =
    (Constants.expoConfig?.extra?.backendUrl as string) || "http://localhost:4020";
  const movementBackendUrl =
    (Constants.expoConfig?.extra?.movementBackendUrl as string) || "http://localhost:3000";

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchAgent(Number(agentId));
        setAgent(data);
        if (data.agent_type === 2) {
          setToolBudget(String(data.tool_cap ?? ""));
        }
      } catch (err: any) {
        setError(err.message || "Failed to load agent.");
      }
    };
    if (agentId) {
      load();
    }
  }, [agentId]);

  const buildPaymentHeader = async (accepts: any) => {
    if (!activeWallet) {
      throw new Error("Wallet not ready");
    }
    const network = String(accepts.network || "");
    const isMovementNetwork = network === "movement" || network.startsWith("movement-");
    if (accepts.scheme !== "exact" || !isMovementNetwork) {
      throw new Error("Unsupported payment scheme or network");
    }
    const amount = Number(accepts.maxAmountRequired);
    if (!Number.isFinite(amount)) {
      throw new Error("Invalid payment amount");
    }

    const hashRes = await fetch(`${movementBackendUrl}/generate-hash`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: activeWallet.address,
        function: "0x1::aptos_account::transfer",
        typeArguments: [],
        functionArguments: [accepts.payTo, amount],
      }),
    });
    if (!hashRes.ok) {
      const text = await hashRes.text();
      throw new Error(text || "Failed to build payment transaction");
    }
    const { hash, rawTxnHex } = await hashRes.json();
    const { signature } = await signRawHash({
      address: activeWallet.address,
      chainType: "aptos",
      hash,
    });

    const headerRes = await fetch(`${movementBackendUrl}/x402/payment-header`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accepts,
        publicKey: activeWallet.public_key,
        signature,
        rawTxnHex,
      }),
    });
    if (!headerRes.ok) {
      const text = await headerRes.text();
      throw new Error(text || "Failed to build payment header");
    }
    const headerData = await headerRes.json();
    if (!headerData.x_payment) {
      throw new Error("Missing payment header");
    }
    return headerData.x_payment as string;
  };

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSvgXml(null);
    setCopyStatus(null);
    try {
      const keypair = generateClientKeypair();
      if (!activeWallet) {
        setError("Movement wallet not ready.");
        return;
      }
      let toolBudgetValue: number | undefined;
      if (agent?.agent_type === 2) {
        const parsedBudget = Math.trunc(Number(toolBudget));
        if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
          setError("Tool budget must be a non-negative integer.");
          return;
        }
        if (agent.tool_cap !== undefined && parsedBudget > Number(agent.tool_cap)) {
          setError("Tool budget exceeds the agent cap.");
          return;
        }
        toolBudgetValue = parsedBudget;
      }
      const requestBody = {
        prompt,
        client_public_key: keypair.publicKeyBase64,
        payer_address: activeWallet.address,
        ...(toolBudgetValue !== undefined ? { tool_budget: toolBudgetValue } : {}),
      };
      const attemptRequest = async (xPayment?: string) =>
        fetch(`${backendUrl}/agents/${Number(agentId)}/use`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(xPayment ? { "x-payment": xPayment } : {}),
          },
          body: JSON.stringify(requestBody),
        });

      let res = await attemptRequest(paymentHeader || undefined);
      if (res.status === 402 && !paymentHeader) {
        const paymentRequired = await res.json();
        const accepts = paymentRequired?.accepts?.[0];
        if (!accepts) {
          throw new Error("Payment required but no requirements provided");
        }
        const xPayment = await buildPaymentHeader(accepts);
        res = await attemptRequest(xPayment);
      }
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || "Request failed");
      }
      const data = await res.json();
      const decrypted = decryptResponse({
        serverPublicKey: data.encrypted_response.server_public_key,
        nonce: data.encrypted_response.nonce,
        ciphertext: data.encrypted_response.ciphertext,
        tag: data.encrypted_response.tag,
        clientSecretKey: keypair.secretKey,
      });
      const trimmed = decrypted.trim();
      const svgStart = trimmed.indexOf("<svg");
      const svgEnd = trimmed.lastIndexOf("</svg>");
      if (svgStart !== -1 && svgEnd !== -1) {
        const svg = trimmed.slice(svgStart, svgEnd + 6);
        setSvgXml(svg);
        setResult(null);
      } else {
        setSvgXml(null);
        setResult(trimmed);
      }
    } catch (err: any) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const copySvg = async () => {
    if (!svgXml) {
      return;
    }
    await Clipboard.setStringAsync(svgXml);
    setCopyStatus("SVG copied to clipboard.");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Use Agent #{agentId}</Text>
        <Text style={styles.label}>Prompt</Text>
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Ask the agent..."
          style={styles.input}
          multiline
        />
        {agent?.agent_type === 2 ? (
          <>
            <Text style={styles.label}>Tool Budget (calls)</Text>
            <TextInput
              value={toolBudget}
              onChangeText={setToolBudget}
              placeholder={String(agent?.tool_cap ?? "")}
              keyboardType="numeric"
              style={styles.input}
            />
            <Text style={styles.note}>
              Base fee {formatMoveAmount(agent.usage_fee)} MOVE +{" "}
              {formatMoveAmount(agent.tool_fee)} MOVE per tool call
            </Text>
          </>
        ) : null}
        {isCreatingWallet ? (
          <Text style={styles.note}>Creating your Movement wallet...</Text>
        ) : null}
        <Text style={styles.label}>x402 Payment Header (optional)</Text>
        <TextInput
          value={paymentHeader}
          onChangeText={setPaymentHeader}
          placeholder="leave blank for auto-pay"
          style={styles.input}
        />
        <TouchableOpacity style={styles.button} onPress={run} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={styles.buttonText}>Pay + Run</Text>
          )}
        </TouchableOpacity>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {svgXml ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>SVG Preview</Text>
            <View style={styles.svgPreview}>
              <SvgXml xml={svgXml} width="100%" height="100%" />
            </View>
            <TouchableOpacity style={styles.secondaryButton} onPress={copySvg}>
              <Text style={styles.secondaryButtonText}>Copy SVG Code</Text>
            </TouchableOpacity>
            {copyStatus ? <Text style={styles.note}>{copyStatus}</Text> : null}
            <Text style={styles.resultTitle}>SVG Code</Text>
            <Text style={styles.svgCode} selectable>
              {svgXml}
            </Text>
          </View>
        ) : null}
        {result ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>Decrypted Result</Text>
            <Text style={styles.resultText}>{result}</Text>
          </View>
        ) : null}
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
  button: {
    marginTop: 10,
    backgroundColor: "#7dd3fc",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: { color: "#0f172a", fontWeight: "600" },
  error: { color: "#fb7185" },
  resultBox: {
    marginTop: 12,
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 12,
    borderColor: "#1f2a40",
    borderWidth: 1,
  },
  resultTitle: { color: "#f8fafc", fontWeight: "600" },
  resultText: { color: "#e2e8f0", marginTop: 6 },
  note: { color: "#94a3b8", fontSize: 12 },
  svgPreview: {
    marginTop: 10,
    width: "100%",
    height: 240,
    borderRadius: 12,
    backgroundColor: "#0b1222",
    borderColor: "#1f2a40",
    borderWidth: 1,
    overflow: "hidden",
  },
  svgCode: {
    color: "#e2e8f0",
    marginTop: 8,
    fontSize: 12,
  },
  secondaryButton: {
    marginTop: 10,
    borderColor: "#7dd3fc",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#7dd3fc", fontWeight: "600" },
});
