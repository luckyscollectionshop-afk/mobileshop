import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";


import { STORE } from "@/constants/store";
import { supabase } from "@/lib/supabase";

type AdminStats = {
  totalOrders: number;
  pendingPayment: number;
  processing: number;
  shipped: number;
  delivered: number;
};

export default function AdminDashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<AdminStats>({
    totalOrders: 0,
    pendingPayment: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
  });

  useEffect(() => {
    checkAdminAndLoadStats();
  }, []);

  async function checkAdminAndLoadStats() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.log("Unable to load admin profile:", profileError.message);

        router.replace("/");
        return;
      }

      if (profile?.role !== "admin") {
        router.replace("/");
        return;
      }

      setIsAdmin(true);

      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, status, payment_status");

      if (ordersError) {
        console.log(
          "Unable to load order statistics:",
          ordersError.message,
        );

        return;
      }

      const orderRows = orders ?? [];

      setStats({
        totalOrders: orderRows.length,

        pendingPayment: orderRows.filter(
          (order) => order.payment_status === "pending",
        ).length,

        processing: orderRows.filter(
          (order) => order.status === "processing",
        ).length,

        shipped: orderRows.filter(
          (order) => order.status === "shipped",
        ).length,

        delivered: orderRows.filter(
          (order) => order.status === "delivered",
        ).length,
      });
    } catch (error) {
      console.log("Admin dashboard error:", error);
      router.replace("/");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        

        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={STORE.colors.primary}
          />

          <Text style={styles.loadingText}>
            Loading admin dashboard...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
     

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <View style={styles.pageHeader}>
          <Text style={styles.title}>Admin Dashboard</Text>

          <Text style={styles.subtitle}>
            Manage your shop and customer orders.
          </Text>
        </View>

        {/* ================================================= */}
        {/* ORDERS */}
        {/* ================================================= */}

        <Pressable
          style={styles.mainCard}
          onPress={() => router.push("/admin/orders")}
        >
          <View style={styles.cardIcon}>
            <Text style={styles.cardIconText}>📦</Text>
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Orders</Text>

            <Text style={styles.cardDescription}>
              View and manage customer orders, payments and order status.
            </Text>
          </View>

          <Text style={styles.arrow}>›</Text>
        </Pressable>

        {/* ================================================= */}
        {/* PRODUCTS */}
        {/* ================================================= */}

        <Pressable
          style={[styles.mainCard, { marginTop: 12 }]}
          onPress={() => router.push("/admin/products")}
        >
          <View style={styles.cardIcon}>
            <Text style={styles.cardIconText}>🛍️</Text>
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Products</Text>

            <Text style={styles.cardDescription}>
              Add, edit and manage your shop products, pricing, stock and
              availability.
            </Text>
          </View>

          <Text style={styles.arrow}>›</Text>
        </Pressable>

        {/* ================================================= */}
        {/* ORDER STATISTICS */}
        {/* ================================================= */}

        <Text style={styles.sectionTitle}>Order overview</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalOrders}</Text>

            <Text style={styles.statLabel}>Total orders</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.pendingPayment}</Text>

            <Text style={styles.statLabel}>Pending payment</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.processing}</Text>

            <Text style={styles.statLabel}>Processing</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.shipped}</Text>

            <Text style={styles.statLabel}>Shipped</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.delivered}</Text>

            <Text style={styles.statLabel}>Delivered</Text>
          </View>
        </View>

        {/* ================================================= */}
        {/* SHOP MANAGEMENT */}
        {/* ================================================= */}

        <Text style={styles.sectionTitle}>Shop management</Text>

        {/* CATEGORIES */}

        <Pressable
          style={styles.mainCard}
          onPress={() => router.push("/admin/categories")}
        >
          <View style={styles.cardIcon}>
            <Text style={styles.cardIconText}>🏷️</Text>
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Categories</Text>

            <Text style={styles.cardDescription}>
              Add, edit and manage the categories used to organize your
              products.
            </Text>
          </View>

          <Text style={styles.arrow}>›</Text>
        </Pressable>

        {/* SHOPFRONT SETTINGS */}

        <Pressable
          style={[styles.mainCard, { marginTop: 12 }]}
          onPress={() => router.push("/admin/shopsettings")}
        >
          <View style={styles.cardIcon}>
            <Text style={styles.cardIconText}>🏠</Text>
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Shopfront settings</Text>

            <Text style={styles.cardDescription}>
              Manage your homepage hero, product sections, social links and
              other storefront settings.
            </Text>
          </View>

          <Text style={styles.arrow}>›</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/* =========================================================
   STYLES
   ========================================================= */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: STORE.colors.background,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6f6d64",
  },

  pageHeader: {
    marginBottom: 24,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#292824",
  },

  subtitle: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 21,
    color: "#716d66",
  },

  mainCard: {
    minHeight: 92,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d8d5cf",
    backgroundColor: "#fffdf9",
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
  },

  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#f0e6d3",
    alignItems: "center",
    justifyContent: "center",
  },

  cardIconText: {
    fontSize: 25,
  },

  cardContent: {
    flex: 1,
    marginLeft: 14,
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#292824",
  },

  cardDescription: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: "#716d66",
  },

  arrow: {
    marginLeft: 8,
    fontSize: 30,
    fontWeight: "300",
    color: "#9a8a6d",
  },

  sectionTitle: {
    marginTop: 30,
    marginBottom: 12,
    fontSize: 18,
    fontWeight: "700",
    color: "#292824",
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  statCard: {
    width: "48%",
    minHeight: 88,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d8d5cf",
    backgroundColor: "#fffdf9",
    padding: 15,
    justifyContent: "center",
  },

  statNumber: {
    fontSize: 25,
    fontWeight: "700",
    color: "#292824",
  },

  statLabel: {
    marginTop: 4,
    fontSize: 11,
    color: "#716d66",
  },
});