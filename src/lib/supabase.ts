import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import "react-native-url-polyfill/auto";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// ---------------------------------------------------------
// STORAGE
// ---------------------------------------------------------
//
// Android / iOS:
//   AsyncStorage
//
// Web / server:
//   localStorage only when window actually exists.
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

const storage = Platform.OS === "web" ? webStorage : AsyncStorage;

// ---------------------------------------------------------
// SUPABASE
// ---------------------------------------------------------

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage,

    autoRefreshToken: true,
    persistSession: true,

    // Mobile apps receive the recovery URL themselves.
    detectSessionInUrl: false,

    // Important for native password-reset deep links.
    flowType: "pkce",
  },
});

// ---------------------------------------------------------
// CART EVENTS
// ---------------------------------------------------------

export const cartEvents = new EventTarget();

export function notifyCartChanged() {
  cartEvents.dispatchEvent(new Event("cartChanged"));
}

// ---------------------------------------------------------
// NOTIFICATION EVENTS
// ---------------------------------------------------------

export const notificationEvents = new EventTarget();

export function notifyNotificationsChanged() {
  notificationEvents.dispatchEvent(new Event("notificationsChanged"));
}
