import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const memoryStore = new Map<string, string>();

const webStorage = {
  async get(key: string) {
    if (typeof window === "undefined") {
      return memoryStore.get(key) ?? null;
    }
    return window.localStorage.getItem(key);
  },
  async put(key: string, value: string) {
    if (typeof window === "undefined") {
      memoryStore.set(key, value);
      return;
    }
    window.localStorage.setItem(key, value);
  },
  async del(key: string) {
    if (typeof window === "undefined") {
      memoryStore.delete(key);
      return;
    }
    window.localStorage.removeItem(key);
  },
  async getKeys() {
    if (typeof window === "undefined") {
      return Array.from(memoryStore.keys());
    }
    return Object.keys(window.localStorage);
  },
};

const nativeStorage = {
  async get(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async put(key: string, value: string) {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  },
  async del(key: string) {
    await SecureStore.deleteItemAsync(key);
  },
  async getKeys() {
    return [];
  },
};

export const privyStorage = Platform.OS === "web" ? webStorage : nativeStorage;
