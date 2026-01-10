import { SafeAreaView, Text, View } from "react-native";
import Constants from "expo-constants";
import LoginScreen from "@/components/LoginScreen";
import { usePrivy } from "@/src/privy";
import { MovementWalletPortfolio } from "@/components/UserScreen";

export default function Index() {
  const { user } = usePrivy();
  const privyAppId = Constants.expoConfig?.extra?.privyAppId;
  const clientId = Constants.expoConfig?.extra?.privyClientId;

  if (!privyAppId || String(privyAppId).length !== 25) {
    return (
      <SafeAreaView>
        <View
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text>You have not set a valid `privyAppId` in app.json</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (!clientId || !String(clientId).startsWith("client-")) {
    return (
      <SafeAreaView>
        <View
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text>
            You have not set a valid privyClientId in app.json
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  return !user ? <LoginScreen /> : <MovementWalletPortfolio />;
}
