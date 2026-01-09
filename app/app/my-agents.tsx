import { Link } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { fetchAgents } from "@/src/lib/api";
import { useMovementAccount } from "@/hooks/useMovementAccount";
import { useFocusEffect } from "@react-navigation/native";

export default function MyAgentsScreen() {
  const { activeWallet, isCreatingWallet } = useMovementAccount();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchAgents();
    const owned = (data.agents || []).filter((agent: any) =>
      activeWallet
        ? agent.owner?.toLowerCase() === activeWallet.address.toLowerCase()
        : false
    );
    setAgents(owned);
    setLoading(false);
  }, [activeWallet?.address]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>My Agents</Text>
        {loading ? <ActivityIndicator color="#7dd3fc" /> : null}
        {isCreatingWallet ? <Text style={styles.note}>Creating your Movement wallet...</Text> : null}
        {!activeWallet && !isCreatingWallet ? (
          <Text style={styles.note}>Connect a Movement wallet to see your agents.</Text>
        ) : null}
        {agents.length === 0 && !loading ? (
          <Text style={styles.note}>No agents found.</Text>
        ) : null}
        {agents.map(agent => (
          <Link key={`my-agent-${agent.agent_id}`} href={`/agents/${agent.agent_id}`} style={styles.card}>
            <Text style={styles.cardTitle}>
              {agent.name ? `${agent.name} (#${agent.agent_id})` : `Agent #${agent.agent_id}`}
            </Text>
            <Text style={styles.meta}>Fee (cents): {agent.usage_fee}</Text>
          </Link>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0f1a" },
  container: { padding: 20, gap: 12 },
  title: { color: "#f8fafc", fontSize: 18, fontWeight: "600" },
  card: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 14,
    borderColor: "#1f2a40",
    borderWidth: 1,
  },
  cardTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "600" },
  meta: { color: "#94a3b8", marginTop: 4, fontSize: 12 },
  note: { color: "#94a3b8" },
});
