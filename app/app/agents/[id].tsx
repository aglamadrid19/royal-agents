import { Link, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { fetchAgent } from "@/src/lib/api";

export default function AgentDetailScreen() {
  const { id } = useLocalSearchParams();
  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchAgent(Number(id));
        setAgent(data);
      } catch (err: any) {
        setError(err.message || "Failed to load agent");
      } finally {
        setLoading(false);
      }
    };
    if (id) {
      load();
    }
  }, [id]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {loading ? <ActivityIndicator color="#7dd3fc" /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {agent ? (
          <View style={styles.card}>
            <Text style={styles.title}>Agent #{agent.agent_id}</Text>
            <Text style={styles.meta}>Owner: {agent.owner}</Text>
            <Text style={styles.meta}>Metadata: {agent.metadata_uri}</Text>
            <Text style={styles.meta}>Fee (cents): {agent.usage_fee}</Text>
            <Text style={styles.meta}>Paused: {String(agent.paused)}</Text>
            <Text style={styles.meta}>Key status: {agent.key_status}</Text>
            <Link href={`/use-agent?agentId=${agent.agent_id}`} style={styles.link}>
              Use Agent
            </Link>
            <Link href={`/marketplace?agentId=${agent.agent_id}`} style={styles.link}>
              List / Buy
            </Link>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0f1a" },
  container: { padding: 20 },
  card: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 16,
    borderColor: "#1f2a40",
    borderWidth: 1,
  },
  title: { color: "#f8fafc", fontSize: 18, fontWeight: "600" },
  meta: { color: "#94a3b8", marginTop: 8, fontSize: 12 },
  link: { color: "#7dd3fc", marginTop: 12 },
  error: { color: "#fb7185" },
});
