import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// ---------------------------------------------------------
// Storage
//
// Android/iOS:
//   Use AsyncStorage.
//
// Web/server:
//   Never access window/localStorage unless it actually exists.
//   Expo Router can evaluate this file on the server.
// ---------------------------------------------------------

const webStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (typeof window === "undefined") {
      return null;
    }

    return window.localStorage.getItem(key);
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(key, value);
  },

  removeItem: async (key: string): Promise<void> => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.removeItem(key);
  },
};

const storage =
  Platform.OS === "web"
    ? webStorage
    : AsyncStorage;

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

export const cartEvents = new EventTarget();

export function notifyCartChanged() {
  cartEvents.dispatchEvent(new Event("cartChanged"));
}