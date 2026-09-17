import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { STORE } from "@/constants/store";
import { registerForPushNotifications } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";

type SiteHeaderProps = {
  cartCount?: number;
};

export default function SiteHeader({ cartCount = 0 }: SiteHeaderProps) {
  const router = useRouter();

  const [menuOpen, setMenuOpen] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Number of unread notifications.
  // IMPORTANT:
  // unread = read_at IS NULL
  const [unreadCount, setUnreadCount] = useState(0);

  /*
   * =========================================================
   * LOAD USER + ROLE + NOTIFICATIONS
   * =========================================================
   */

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) {
        setIsLoggedIn(false);
        setIsAdmin(false);
        setUserId(null);
        setUnreadCount(0);
        return;
      }

      setIsLoggedIn(true);
      setUserId(user.id);

      registerForPushNotifications();

      // -------------------------------------------------------
      // Load profile role
      // -------------------------------------------------------

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (profileError) {
        console.log("Unable to load profile role:", profileError.message);

        setIsAdmin(false);
      } else {
        setIsAdmin(profile?.role === "admin");
      }

      // -------------------------------------------------------
      // Load unread notification count
      //
      // IMPORTANT:
      // read_at IS NULL = unread
      // -------------------------------------------------------

      await loadUnreadNotifications(user.id);
    }

    loadUser();

    /*
     * =========================================================
     * AUTH STATE
     * =========================================================
     */

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (!session?.user) {
        setIsLoggedIn(false);
        setIsAdmin(false);
        setUserId(null);
        setUnreadCount(0);
        return;
      }

      const user = session.user;

      setIsLoggedIn(true);
      setUserId(user.id);

      registerForPushNotifications();

      // -----------------------------------------------------
      // Load role
      // -----------------------------------------------------

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (profileError) {
        console.log("Unable to load profile role:", profileError.message);

        setIsAdmin(false);
      } else {
        setIsAdmin(profile?.role === "admin");
      }

      // -----------------------------------------------------
      // Load unread notifications
      // -----------------------------------------------------

      await loadUnreadNotifications(user.id);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const channel = supabase
      .channel(`header-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadUnreadNotifications(userId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);
  /*
   * =========================================================
   * UNREAD NOTIFICATIONS
   * =========================================================
   */

  async function loadUnreadNotifications(currentUserId: string) {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("user_id", currentUserId)
      .is("read_at", null);

    if (error) {
      console.log("Unable to load notification count:", error.message);

      setUnreadCount(0);
      return;
    }

    setUnreadCount(count ?? 0);
  }

  /*
   * =========================================================
   * MENU HELPERS
   * =========================================================
   */

  function closeMenu() {
    setMenuOpen(false);
  }

  function goTo(path: string) {
    closeMenu();
    router.push(path as any);
  }

  /*
   * =========================================================
   * SIGN OUT
   * =========================================================
   */

  async function handleSignOut() {
    closeMenu();

    try {
      await supabase.auth.signOut();

      setIsLoggedIn(false);
      setIsAdmin(false);
      setUserId(null);
      setUnreadCount(0);

      router.replace("/");
    } catch (error) {
      console.log("Sign out error:", error);
    }
  }

  /*
   * =========================================================
   * UI
   * =========================================================
   */

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.header}>
        {/* ================================================= */}
        {/* LOGO */}
        {/* ================================================= */}

        <Pressable onPress={() => goTo("/")} style={styles.logoContainer}>
          <Image
            source={require("@/assets/images/lcc.svg")}
            style={styles.logo}
            contentFit="contain"
          />
        </Pressable>

        {/* ================================================= */}
        {/* RIGHT SIDE */}
        {/* ================================================= */}

        <View style={styles.rightSection}>
          {/* =================================================
              NOTIFICATION BELL
             ================================================= */}

          {userId && (
            <Pressable
              onPress={() => {
                router.push("/notifications");
              }}
              style={styles.iconButton}
            >
              <View style={styles.bellContainer}>
                <Text style={styles.bell}>🔔</Text>

                {unreadCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          )}

          {/* =================================================
              MENU
             ================================================= */}

          <Pressable
            onPress={() => setMenuOpen((previous) => !previous)}
            style={[styles.menuButton, menuOpen && styles.menuButtonOpen]}
          >
            <Text style={styles.menuText}>Menu</Text>

            <Text style={[styles.chevron, menuOpen && styles.chevronOpen]}>
              ⌄
            </Text>
          </Pressable>
        </View>

        {/* ================================================= */}
        {/* DROPDOWN */}
        {/* ================================================= */}

        {menuOpen && (
          <Modal
            transparent
            visible
            animationType="none"
            onRequestClose={closeMenu}
          >
            <View style={styles.modalOverlay}>
              <Pressable style={styles.backdrop} onPress={closeMenu} />

              <View style={styles.dropdown}>
                {/* HOME */}

                <Pressable
                  onPress={() => goTo("/")}
                  style={styles.dropdownItem}
                >
                  <Text style={styles.dropdownText}>Home</Text>
                </Pressable>

                {/* PRODUCTS */}

                <Pressable
                  onPress={() => goTo("/explore")}
                  style={styles.dropdownItem}
                >
                  <Text style={styles.dropdownText}>Products</Text>
                </Pressable>

                {/* =================================================
                  LOGGED IN
                 ================================================= */}

                {isLoggedIn ? (
                  <>
                    {/* CART */}

                    <Pressable
                      onPress={() => goTo("/cart")}
                      style={styles.dropdownItem}
                    >
                      <Text style={styles.dropdownText}>
                        🛒 Cart
                        {cartCount > 0 ? ` (${cartCount})` : ""}
                      </Text>
                    </Pressable>

                    {/* ORDERS */}

                    <Pressable
                      onPress={() => goTo("/orders")}
                      style={styles.dropdownItem}
                    >
                      <Text style={styles.dropdownText}>Orders</Text>
                    </Pressable>

                    {/* ADMIN */}

                    {isAdmin && (
                      <Pressable
                        onPress={() => goTo("/admin")}
                        style={styles.dropdownItem}
                      >
                        <Text style={[styles.dropdownText, styles.adminText]}>
                          Admin
                        </Text>
                      </Pressable>
                    )}

                    <View style={styles.separator} />

                    {/* SIGN OUT */}

                    <Pressable
                      onPress={handleSignOut}
                      style={styles.dropdownItem}
                    >
                      <Text style={[styles.dropdownText, styles.signOutText]}>
                        Sign out
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    {/* SIGN IN */}

                    <Pressable
                      onPress={() => goTo("/auth/login")}
                      style={styles.dropdownItem}
                    >
                      <Text style={styles.dropdownText}>Sign in</Text>
                    </Pressable>

                    {/* CREATE ACCOUNT */}

                    <Pressable
                      onPress={() => goTo("/auth/signup")}
                      style={styles.dropdownItem}
                    >
                      <Text
                        style={[styles.dropdownText, styles.createAccountText]}
                      >
                        Create account
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          </Modal>
        )}
      </View>
    </SafeAreaView>
  );
}

/* =========================================================
   STYLES
   ========================================================= */

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#0d0d0d",
  },

  header: {
    height: 55,
    backgroundColor: STORE.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: "#252525",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
    zIndex: 100,
    elevation: 100,
  },

  logoContainer: {
    width: 80,
    height: 54,
    backgroundColor: STORE.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },

  logo: {
    width: 90,
    height: 54,
  },

  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 3,
    gap: 1,
  },

  iconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  bellContainer: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  bell: {
    fontSize: 20,
  },

  /*
   * Notification badge
   */

  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -7,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: "#b3261e",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: STORE.colors.background,
  },

  notificationBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },

  menuButton: {
    height: 32,
    minWidth: 104,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: STORE.colors.background,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  menuButtonOpen: {
    backgroundColor: STORE.colors.background,
  },

  menuText: {
    fontSize: 14,
    fontWeight: "400",
    color: "#292824",
  },

  chevron: {
    fontSize: 27,
    lineHeight: 24,
    color: "#96938e",
    marginTop: -5,
  },

  chevronOpen: {
    transform: [{ rotate: "180deg" }],
    marginTop: 5,
  },

  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
  },

  modalOverlay: {
    flex: 1,
  },

  dropdown: {
    position: "absolute",
    top: 85,
    right: 0,
    width: 150,
    backgroundColor: STORE.colors.background,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d8d5cf",
    paddingVertical: 10,
    zIndex: 1,
    elevation: 1,

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.16,
    shadowRadius: 7,
  },

  dropdownItem: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: 32,
  },

  dropdownText: {
    fontSize: 12,
    fontWeight: "400",
    color: "#302f2b",
  },

  adminText: {
    fontWeight: "700",
  },

  createAccountText: {
    color: "#bd9650",
  },

  separator: {
    height: 1,
    backgroundColor: "#e3e0da",
    marginHorizontal: 18,
    marginVertical: 3,
  },

  signOutText: {
    color: "#b3261e",
  },
});
