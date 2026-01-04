import { Link } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { fetchAgents } from "@/src/lib/api";
import { useFocusEffect } from "@react-navigation/native";

export default function AgentsScreen() {
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAgents();
      setAgents(data.agents || []);
    } catch (err: any) {
      setError(err.message || "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {loading ? <ActivityIndicator color="#7dd3fc" /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {agents.map(agent => (
          <Link
            key={`agent-${agent.agent_id}`}
            href={`/agents/${agent.agent_id}`}
            style={styles.card}
          >
            <Text style={styles.cardTitle}>Agent #{agent.agent_id}</Text>
            <Text style={styles.meta}>Owner: {agent.owner}</Text>
            <Text style={styles.meta}>Fee (cents): {agent.usage_fee}</Text>
            <Text style={styles.meta}>Paused: {String(agent.paused)}</Text>
            <Text style={styles.meta}>Key status: {agent.key_status}</Text>
          </Link>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0f1a" },
  container: { padding: 20, gap: 14 },
  card: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 14,
    borderColor: "#1f2a40",
    borderWidth: 1,
  },
  cardTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "600" },
  meta: { color: "#94a3b8", marginTop: 4, fontSize: 12 },
  error: { color: "#fb7185" },
});
