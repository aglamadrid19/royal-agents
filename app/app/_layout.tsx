import Constants from "expo-constants";
import { Stack } from "expo-router";
import { PrivyElements, PrivyProvider } from "@/src/privy";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { useFonts } from "expo-font";
import { privyStorage } from "@/src/privyStorage";

export default function RootLayout() {
  useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const privyAppId = Constants.expoConfig?.extra?.privyAppId;
  const clientId = Constants.expoConfig?.extra?.privyClientId;
  const providerProps = { appId: privyAppId, clientId, storage: privyStorage };
  return (
    <PrivyProvider {...providerProps}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0f172a" },
          headerTintColor: "#f8fafc",
        }}
      >
        <Stack.Screen name="index" options={{ title: "RoyalAgents" }} />
        <Stack.Screen name="agents/index" options={{ title: "Agents" }} />
        <Stack.Screen name="agents/[id]" options={{ title: "Agent Detail" }} />
        <Stack.Screen name="use-agent" options={{ title: "Use Agent" }} />
        <Stack.Screen name="my-agents" options={{ title: "My Agents" }} />
        <Stack.Screen name="create-agent" options={{ title: "Create Agent" }} />
        <Stack.Screen name="agent-config" options={{ title: "Agent Config" }} />
        <Stack.Screen name="set-key" options={{ title: "Set API Key" }} />
        <Stack.Screen name="marketplace" options={{ title: "Marketplace" }} />
      </Stack>
      <PrivyElements />
    </PrivyProvider>
  );
}
