import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePrivy } from "@privy-io/expo";
import { useMovementWallet } from "../hooks/useMovement";
import { useCreateWallet } from "@privy-io/expo/extended-chains";
import { Link } from "expo-router";

export const MovementWalletPortfolio = () => {
  const { user, logout } = usePrivy();
  const { createWallet } = useCreateWallet();
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [isLoadingFaucet, setIsLoadingFaucet] = useState(false);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [isLoadingSend, setIsLoadingSend] = useState(false);
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const { signAndSubmitTransaction, getWalletBalance, getAccountInfo, requestFaucet } =
    useMovementWallet();

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  const movementWallets: any[] = useMemo(() => {
    if (!user?.linked_accounts) return [];

    return user.linked_accounts.filter(
      (account: any) => account.type === "wallet" && account.chain_type === "aptos"
    );
  }, [user?.linked_accounts]);

  useEffect(() => {
    const createMovementWallet = async () => {
      if (user && movementWallets.length === 0 && !isCreatingWallet) {
        setIsCreatingWallet(true);
        try {
          await createWallet({
            chainType: "aptos",
          });
          showModal("Success", "Movement wallet created successfully!");
        } catch (error) {
          console.error("Failed to create Movement wallet:", error);
          showModal(
            "Wallet Creation Failed",
            "Failed to create Movement wallet. You can logout and try again."
          );
        } finally {
          setIsCreatingWallet(false);
        }
      }
    };

    createMovementWallet();
  }, [user, movementWallets.length, createWallet, isCreatingWallet]);

  const activeWallet = useMemo(() => {
    if (!selectedWallet) return movementWallets[0];
    return movementWallets.find(w => w.address === selectedWallet) || movementWallets[0];
  }, [selectedWallet, movementWallets]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!activeWallet) return;
      try {
        const balance = await getWalletBalance(activeWallet.address);
        setWalletBalance(balance / 1e8);
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    };
    fetchBalance();
  }, [activeWallet, getWalletBalance]);

  const handleSendTransaction = useCallback(async () => {
    if (!activeWallet) return;

    setIsLoadingSend(true);
    try {
      const result = await signAndSubmitTransaction(
        activeWallet.public_key,
        activeWallet.address,
        "0x1::aptos_account::transfer",
        [],
        [
          "0x9b0e90c9f3d8e5b3d8cfc9a0c0f9621c742e5675b4f4e772fbef457b73ef4e4a",
          1_00000000,
        ]
      );

      showModal(
        "Transaction Sent",
        `Hash: ${result.transactionHash}\nStatus: ${result.vmStatus}`
      );
      const newBalance = await getWalletBalance(activeWallet.address);
      setWalletBalance(newBalance / 1e8);
    } catch (error: any) {
      console.error("Transaction error:", error);
      showModal("Transaction Failed", error.message || "Failed to send transaction");
    } finally {
      setIsLoadingSend(false);
    }
  }, [activeWallet, signAndSubmitTransaction, getWalletBalance]);

  const handleGetAccountInfo = useCallback(async () => {
    if (!activeWallet) return;

    setIsLoadingInfo(true);
    try {
      const info = await getAccountInfo(activeWallet.address);
      const infoText = Object.entries(info)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");

      showModal("Account Info", infoText);
    } catch (error) {
      showModal("Error", "Failed to fetch account info");
    } finally {
      setIsLoadingInfo(false);
    }
  }, [activeWallet, getAccountInfo]);

  const handleRequestFaucet = useCallback(async () => {
    if (!activeWallet) return;

    setIsLoadingFaucet(true);
    try {
      await requestFaucet(activeWallet.address, 1_00000000);
      showModal("Success", "Faucet request submitted! Check your wallet soon.");

      const balance = await getWalletBalance(activeWallet.address);
      setWalletBalance(balance / 1e8);
    } catch (error) {
      showModal("Error", "Failed to request faucet funds");
    } finally {
      setIsLoadingFaucet(false);
    }
  }, [activeWallet, requestFaucet, getWalletBalance]);

  const formatAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!user) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="wallet-outline" size={64} color="#cbd5e1" />
        <Text style={styles.emptyText}>Please login to view your wallets</Text>
      </View>
    );
  }

  if (isCreatingWallet) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color="#5b21b6" />
        <Text style={styles.emptyText}>Creating your Movement wallet...</Text>
        <Text style={styles.emptySubtext}>This will only take a moment</Text>
      </View>
    );
  }

  if (movementWallets.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="wallet-outline" size={64} color="#cbd5e1" />
        <Text style={styles.emptyText}>Setting up your wallet...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Movement Wallet</Text>
            <Text style={styles.headerSubtitle}>
              {movementWallets.length} {movementWallets.length === 1 ? "wallet" : "wallets"} connected
            </Text>
          </View>
          <Pressable style={styles.logoutButton} onPress={logout}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          </Pressable>
        </View>
      </View>

      <View style={styles.walletsContainer}>
        {movementWallets.map((wallet, index) => (
          <Pressable
            key={`${wallet.address}-${index}`}
            style={[
              styles.walletCard,
              activeWallet?.address === wallet.address && styles.walletCardActive,
            ]}
            onPress={() => setSelectedWallet(wallet.address)}
          >
            <View style={styles.walletCardHeader}>
              <View style={styles.walletIconContainer}>
                <Ionicons name="wallet" size={24} color="#5b21b6" />
              </View>
              <View style={styles.walletInfo}>
                <Text style={styles.walletLabel}>Movement Wallet {index + 1}</Text>
                <Text style={styles.walletAddress}>{formatAddress(wallet.address)}</Text>
              </View>
            </View>

            {activeWallet?.address === wallet.address && (
              <View style={styles.walletCardFooter}>
                <View style={styles.badge}>
                  <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                  <Text style={styles.badgeText}>Active</Text>
                </View>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {activeWallet && (
        <View style={styles.detailsContainer}>
          <Text style={styles.sectionTitle}>Wallet Details</Text>

          <View style={styles.addressCard}>
            <View style={styles.addressHeader}>
              <Ionicons name="key" size={20} color="#64748b" />
              <Text style={styles.addressLabel}>Wallet Address</Text>
            </View>
            <View style={styles.addressContent}>
              <Text style={styles.addressText}>{activeWallet.address}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Balance:</Text>
              <Text style={styles.infoValue}>
                {walletBalance !== null ? `${walletBalance} MOVE` : "Loading..."}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Chain Type:</Text>
              <Text style={styles.infoValue}>Movement</Text>
            </View>
          </View>

          <View style={styles.actionsContainer}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>

            <Pressable
              style={[styles.actionButton]}
              onPress={handleSendTransaction}
              disabled={isLoadingSend}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="send" size={22} color="#5b21b6" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Send 1 MOVE</Text>
                <Text style={styles.actionSubtitle}>
                  {isLoadingSend ? "Sending..." : "Send 1 MOVE to test address"}
                </Text>
              </View>
              {isLoadingSend ? (
                <ActivityIndicator size="small" color="#5b21b6" />
              ) : (
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
              )}
            </Pressable>

            <Pressable
              style={styles.actionButton}
              onPress={handleGetAccountInfo}
              disabled={isLoadingInfo}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="information-circle" size={22} color="#0891b2" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Account Info</Text>
                <Text style={styles.actionSubtitle}>
                  {isLoadingInfo ? "Loading..." : "View account details"}
                </Text>
              </View>
              {isLoadingInfo ? (
                <ActivityIndicator size="small" color="#5b21b6" />
              ) : (
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
              )}
            </Pressable>

            <Pressable
              style={[styles.actionButton, styles.faucetButton]}
              onPress={handleRequestFaucet}
              disabled={isLoadingFaucet}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="water" size={22} color="#f59e0b" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Request Faucet</Text>
                <Text style={styles.actionSubtitle}>
                  {isLoadingFaucet ? "Requesting..." : "Get testnet tokens"}
                </Text>
              </View>
              {isLoadingFaucet ? (
                <ActivityIndicator size="small" color="#f59e0b" />
              ) : (
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
              )}
            </Pressable>
          </View>

          <View style={styles.royalAgentsContainer}>
            <Text style={styles.sectionTitle}>RoyalAgents</Text>
            <Text style={styles.royalAgentsSubtitle}>
              Browse, configure, and use AI agents from your Movement wallet.
            </Text>
            <Link href="/create-agent" style={styles.royalAgentsLink}>
              Create Agent (Type 1)
            </Link>
            <Link href="/agents" style={styles.royalAgentsLink}>
              Browse Agents
            </Link>
            <Link href="/my-agents" style={styles.royalAgentsLink}>
              My Agents
            </Link>
            <Link href="/set-key" style={styles.royalAgentsLink}>
              Set / Update API Key
            </Link>
            <Link href="/use-agent" style={styles.royalAgentsLink}>
              Use Agent
            </Link>
            <Link href="/marketplace" style={styles.royalAgentsLink}>
              Marketplace
            </Link>
          </View>
        </View>
      )}

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <ScrollView>
              <Text style={styles.modalText}>{modalMessage}</Text>
            </ScrollView>
            <Pressable onPress={() => setModalVisible(false)} style={styles.modalButton}>
              <Text style={styles.modalButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fef2f2",
    justifyContent: "center",
    alignItems: "center",
  },
  walletsContainer: {
    padding: 20,
    gap: 12,
  },
  walletCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: "#e2e8f0",
  },
  walletCardActive: {
    borderColor: "#5b21b6",
    backgroundColor: "#faf5ff",
  },
  walletCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  walletIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f5f3ff",
    justifyContent: "center",
    alignItems: "center",
  },
  walletInfo: {
    flex: 1,
  },
  walletLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 4,
  },
  walletAddress: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "monospace",
  },
  walletCardFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#10b981",
  },
  detailsContainer: {
    padding: 20,
    gap: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
  },
  addressCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  addressContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    fontFamily: "monospace",
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 13,
    color: "#0f172a",
    fontWeight: "600",
  },
  actionsContainer: {
    gap: 12,
  },
  actionButton: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  faucetButton: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 13,
    color: "#64748b",
  },
  royalAgentsContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
  },
  royalAgentsSubtitle: {
    color: "#475569",
    fontSize: 13,
    marginBottom: 12,
  },
  royalAgentsLink: {
    color: "#5b21b6",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    backgroundColor: "#f8fafc",
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#475569",
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 8,
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    width: "90%",
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  modalText: {
    color: "#334155",
  },
  modalButton: {
    marginTop: 20,
    backgroundColor: "#5b21b6",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
