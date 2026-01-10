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
import { useRouter } from "expo-router";
import { parseMoveAmount } from "@/src/lib/move";

export default function CreateAgentScreen() {
  const router = useRouter();
  const [agentType, setAgentType] = useState<"hosted" | "runner">("hosted");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [model, setModel] = useState("grok-4-1-fast-reasoning");
  const [metadataUri, setMetadataUri] = useState("");
  const [usageFee, setUsageFee] = useState("0.5");
  const [toolFee, setToolFee] = useState("1");
  const [toolCap, setToolCap] = useState("3");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const next = () => {
    setStatus(null);
    if (!name.trim()) {
      setStatus("Name is required.");
      return;
    }
    if (!description.trim()) {
      setStatus("Description is required.");
      return;
    }
    if (!model.trim()) {
      setStatus("Model is required.");
      return;
    }
    let parsedFee = 0;
    let parsedToolFee = 0;
    let parsedToolCap = 0;
    try {
      parsedFee = parseMoveAmount(usageFee);
      if (agentType === "runner") {
        parsedToolFee = parseMoveAmount(toolFee);
        parsedToolCap = Math.trunc(Number(toolCap));
        if (!Number.isFinite(parsedToolCap) || parsedToolCap <= 0) {
          setStatus("Tool cap must be a positive integer.");
          return;
        }
      }
    } catch (err: any) {
      setStatus(err.message || "Enter a valid fee amount.");
      return;
    }
    setLoading(true);
    router.push({
      pathname: "/agent-config",
      params: {
        name,
        description,
        model,
        metadataUri,
        agentType: agentType === "runner" ? "2" : "1",
        usageFee: String(parsedFee),
        toolFee: String(parsedToolFee),
        toolCap: String(parsedToolCap),
      },
    });
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Create Agent</Text>
        <Text style={styles.note}>Choose hosted (Type 1) or runner (Type 2).</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.toggle, agentType === "hosted" && styles.toggleActive]}
            onPress={() => {
              setAgentType("hosted");
              setModel("grok-4-1-fast-reasoning");
            }}
          >
            <Text style={styles.toggleText}>Type 1 (Hosted)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggle, agentType === "runner" && styles.toggleActive]}
            onPress={() => {
              setAgentType("runner");
              setModel("logo-runner-v1");
            }}
          >
            <Text style={styles.toggleText}>Type 2 (Runner)</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.label}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="SciGrok"
          style={styles.input}
        />
        <Text style={styles.label}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Scientific researcher agent"
          style={[styles.input, styles.multiline]}
          multiline
        />
        <Text style={styles.label}>Model</Text>
        <TextInput
          value={model}
          onChangeText={setModel}
          placeholder="grok-4-1-fast-reasoning"
          style={styles.input}
        />
        <Text style={styles.label}>Metadata URI (image or branding)</Text>
        <TextInput
          value={metadataUri}
          onChangeText={setMetadataUri}
          placeholder="https://... or ipfs://..."
          style={styles.input}
          autoCapitalize="none"
        />
        <Text style={styles.label}>Base Fee (MOVE)</Text>
        <TextInput
          value={usageFee}
          onChangeText={setUsageFee}
          placeholder="0.5"
          keyboardType="numeric"
          style={styles.input}
        />
        {agentType === "runner" ? (
          <>
            <Text style={styles.label}>Tool Fee (MOVE per call)</Text>
            <TextInput
              value={toolFee}
              onChangeText={setToolFee}
              placeholder="1"
              keyboardType="numeric"
              style={styles.input}
            />
            <Text style={styles.label}>Tool Cap (max calls per request)</Text>
            <TextInput
              value={toolCap}
              onChangeText={setToolCap}
              placeholder="3"
              keyboardType="numeric"
              style={styles.input}
            />
          </>
        ) : null}
        <TouchableOpacity style={styles.button} onPress={next} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={styles.buttonText}>Next: Configure Agent</Text>
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
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  toggle: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#1f2a40",
  },
  toggleActive: { backgroundColor: "#7dd3fc", borderColor: "#7dd3fc" },
  toggleText: { color: "#e2e8f0", fontSize: 12 },
  label: { color: "#94a3b8", fontSize: 12 },
  input: {
    backgroundColor: "#0b1222",
    borderRadius: 12,
    padding: 12,
    color: "#e2e8f0",
    borderColor: "#1f2a40",
    borderWidth: 1,
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },
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
