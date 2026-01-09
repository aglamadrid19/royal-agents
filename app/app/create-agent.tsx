import { useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";

export default function CreateAgentScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [model, setModel] = useState("grok-4-1-fast-reasoning");
  const [metadataUri, setMetadataUri] = useState("");
  const [usageFee, setUsageFee] = useState("100");
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
    const parsedFee = Number(usageFee);
    if (!Number.isFinite(parsedFee) || parsedFee <= 0) {
      setStatus("Enter a valid usage fee in USD cents.");
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
        usageFee: String(parsedFee),
      },
    });
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Create Type 1 Agent</Text>
        <Text style={styles.note}>Provider is fixed to xAI for Type 1 agents.</Text>
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
        <Text style={styles.label}>Usage Fee (USD cents)</Text>
        <TextInput
          value={usageFee}
          onChangeText={setUsageFee}
          placeholder="100"
          keyboardType="numeric"
          style={styles.input}
        />
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
