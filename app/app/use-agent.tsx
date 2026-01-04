import { useLocalSearchParams } from "expo-router";
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
import { useMovementAccount } from "@/hooks/useMovementAccount";
import { generateClientKeypair, decryptResponse } from "@/src/lib/crypto";
import { useAgent } from "@/src/lib/api";

export default function UseAgentScreen() {
  const { agentId } = useLocalSearchParams();
  const { activeWallet, isCreatingWallet } = useMovementAccount();
  const [prompt, setPrompt] = useState("");
  const [paymentHeader, setPaymentHeader] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const keypair = generateClientKeypair();
      if (!activeWallet) {
        setError("Movement wallet not ready.");
        return;
      }
      const data = await useAgent({
        agentId: Number(agentId),
        prompt,
        clientPublicKey: keypair.publicKeyBase64,
        payerAddress: activeWallet.address,
        paymentHeader: paymentHeader || undefined,
      });
      const decrypted = decryptResponse({
        serverPublicKey: data.encrypted_response.server_public_key,
        nonce: data.encrypted_response.nonce,
        ciphertext: data.encrypted_response.ciphertext,
        tag: data.encrypted_response.tag,
        clientSecretKey: keypair.secretKey,
      });
      setResult(decrypted);
    } catch (err: any) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
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
        {isCreatingWallet ? (
          <Text style={styles.note}>Creating your Movement wallet...</Text>
        ) : null}
        <Text style={styles.label}>x402 Payment Header (optional)</Text>
        <TextInput
          value={paymentHeader}
          onChangeText={setPaymentHeader}
          placeholder="paste x-payment header"
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
});
