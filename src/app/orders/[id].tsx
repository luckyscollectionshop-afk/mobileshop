import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "@/lib/supabase";
import { STORE } from "@/constants/store";

type OrderItem = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  shipping_cost: number;
  total: number;

  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_postal_code: string;
  shipping_country: string;

  customer_note: string | null;

  created_at: string;
  payment_verified_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;

  order_items: OrderItem[];
};

export default function OrderDetailScreen() {
  const router = useRouter();

  const { id } = useLocalSearchParams<{
    id: string;
  }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [catalogMode, setCatalogMode] = useState(false);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (id) {
        loadOrder();
      }
    }, [id]),
  );

  async function loadOrder() {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.replace(`/auth/login?redirectTo=/orders/${id}`);
        return;
      }
      const { data: siteSettings, error: siteSettingsError } = await supabase
        .from("site_settings")
        .select("catalog_mode")
        .eq("id", true)
        .maybeSingle();

      if (siteSettingsError) {
        throw siteSettingsError;
      }

      setCatalogMode(Boolean(siteSettings?.catalog_mode));

      const { data, error: orderError } = await supabase
        .from("orders")
        .select(
          `
              id,
              order_number,
              status,
              payment_method,
              payment_status,
              subtotal,
              shipping_cost,
              total,
              shipping_name,
              shipping_phone,
              shipping_address,
              shipping_city,
              shipping_postal_code,
              shipping_country,
              customer_note,
              created_at,
              payment_verified_at,
              shipped_at,
              delivered_at,
              order_items (
                id,
                product_name,
                quantity,
                unit_price,
                total_price
              )
            `,
        )
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (orderError) {
        throw orderError;
      }

      if (!data) {
        setError("This order could not be found.");
        return;
      }

      const formattedOrder: Order = {
        ...data,

        subtotal: Number(data.subtotal ?? 0),

        shipping_cost: Number(data.shipping_cost ?? 0),

        total: Number(data.total ?? 0),

        order_items: (data.order_items ?? []).map((item) => ({
          ...item,
          unit_price: Number(item.unit_price ?? 0),
          total_price: Number(item.total_price ?? 0),
        })),
      };

      setOrder(formattedOrder);
    } catch (err) {
      console.error("❌ Load order detail error:", err);

      setError("Unable to load this order. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function formatDate(date: string | null) {
    if (!date) {
      return null;
    }

    return new Date(date).toLocaleDateString("en-CH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function paymentLabel(method: string) {
    return method === "twint" ? "TWINT" : "Bank Transfer";
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>Loading order...</Text>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContent}>
          <Text style={styles.errorTitle}>Order unavailable</Text>

          <Text style={styles.errorMessage}>
            {error ?? "This order could not be found."}
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() => router.replace("/orders")}
          >
            <Text style={styles.primaryButtonText}>Back to my orders</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const timeline = [
    {
      title: "Order placed",
      date: formatDate(order.created_at),
      done: true,
    },
    {
      title: "Payment verified",
      date: formatDate(order.payment_verified_at),
      done: !!order.payment_verified_at,
    },
    {
      title: "Shipped",
      date: formatDate(order.shipped_at),
      done: !!order.shipped_at,
    },
    {
      title: "Delivered",
      date: formatDate(order.delivered_at),
      done: !!order.delivered_at,
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {/* Header */}

        <Pressable onPress={() => router.replace("/orders")} hitSlop={10}>
          <Text style={styles.backText}>← Back to my orders</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>Order {order.order_number}</Text>

          <Text style={styles.date}>{formatDate(order.created_at)}</Text>
        </View>

        {/* Status */}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order status</Text>

          <View style={styles.timeline}>
            {timeline.map((step, index) => (
              <View key={step.title} style={styles.timelineRow}>
                <View style={styles.timelineLeft}>
                  <View
                    style={[
                      styles.timelineCircle,
                      step.done && styles.timelineCircleDone,
                    ]}
                  >
                    {step.done ? (
                      <Text style={styles.timelineCheck}>✓</Text>
                    ) : null}
                  </View>

                  {index < timeline.length - 1 && (
                    <View
                      style={[
                        styles.timelineLine,
                        timeline[index + 1].done && styles.timelineLineDone,
                      ]}
                    />
                  )}
                </View>

                <View style={styles.timelineContent}>
                  <Text
                    style={[
                      styles.timelineTitle,
                      step.done && styles.timelineTitleDone,
                    ]}
                  >
                    {step.title}
                  </Text>

                  {step.date ? (
                    <Text style={styles.timelineDate}>{step.date}</Text>
                  ) : (
                    <Text style={styles.timelinePending}>Pending</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Order items */}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order items</Text>

          <View style={styles.items}>
            {order.order_items.map((item) => (
              <View key={item.id} style={styles.item}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.product_name}</Text>

                  <Text style={styles.itemQuantity}>
                    {catalogMode
                      ? `Quantity: ${item.quantity}`
                      : `CHF ${item.unit_price.toFixed(2)} × ${item.quantity}`}
                  </Text>
                </View>

                {!catalogMode ? (
                  <Text style={styles.itemTotal}>
                    CHF {item.total_price.toFixed(2)}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>

        {/* Shipping address */}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Shipping address</Text>

          <View style={styles.address}>
            <Text style={styles.addressName}>{order.shipping_name}</Text>

            <Text style={styles.addressText}>{order.shipping_address}</Text>

            <Text style={styles.addressText}>
              {order.shipping_postal_code} {order.shipping_city}
            </Text>

            <Text style={styles.addressText}>{order.shipping_country}</Text>

            <Text style={styles.addressPhone}>{order.shipping_phone}</Text>
          </View>
        </View>

        {/* Note */}

        {order.customer_note ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Note</Text>

            <Text style={styles.note}>{order.customer_note}</Text>
          </View>
        ) : null}

        {/* Payment */}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Method</Text>

            <Text style={styles.detailValue}>
              {paymentLabel(order.payment_method)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>

            <Text style={styles.detailValue}>{order.payment_status}</Text>
          </View>
        </View>

        {/* Summary */}

       {!catalogMode ? (
  <View style={styles.card}>
    <Text style={styles.sectionTitle}>
      Order summary
    </Text>

    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>
        Subtotal
      </Text>

      <Text style={styles.detailValue}>
        CHF {order.subtotal.toFixed(2)}
      </Text>
    </View>

    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>
        Shipping
      </Text>

      <Text style={styles.detailValue}>
        {order.shipping_cost === 0
          ? "FREE"
          : `CHF ${order.shipping_cost.toFixed(2)}`}
      </Text>
    </View>

    <View style={styles.divider} />

    <View style={styles.totalRow}>
      <Text style={styles.totalLabel}>
        Total
      </Text>

      <Text style={styles.totalValue}>
        CHF {order.total.toFixed(2)}
      </Text>
    </View>
  </View>
) : null}

        {/* Bottom button */}

        <Pressable
          style={styles.primaryButton}
          onPress={() => router.replace("/orders")}
        >
          <Text style={styles.primaryButtonText}>Back to my orders</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: STORE.colors.background,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: STORE.colors.background,
  },

  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 25,
  },

  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#777",
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 50,
  },

  backText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#555",
  },

  header: {
    marginTop: 20,
    marginBottom: 22,
  },

  title: {
    fontSize: 25,
    fontWeight: "700",
    color: "#222",
  },

  date: {
    marginTop: 5,
    fontSize: 12,
    color: "#777",
  },

  card: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#ddd8cf",
    borderRadius: 14,
    padding: 15,
    backgroundColor: "rgba(255,255,255,0.45)",
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#222",
    marginBottom: 15,
  },

  timeline: {
    paddingTop: 2,
  },

  timelineRow: {
    flexDirection: "row",
    minHeight: 58,
  },

  timelineLeft: {
    width: 30,
    alignItems: "center",
  },

  timelineCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#bbb",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },

  timelineCircleDone: {
    borderColor: "#bd9650",
    backgroundColor: "#bd9650",
  },

  timelineCheck: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },

  timelineLine: {
    width: 1,
    flex: 1,
    marginVertical: 3,
    backgroundColor: "#ddd",
  },

  timelineLineDone: {
    backgroundColor: "#bd9650",
  },

  timelineContent: {
    flex: 1,
    marginLeft: 10,
    paddingBottom: 15,
  },

  timelineTitle: {
    fontSize: 13,
    color: "#777",
  },

  timelineTitleDone: {
    fontWeight: "600",
    color: "#222",
  },

  timelineDate: {
    marginTop: 3,
    fontSize: 11,
    color: "#888",
  },

  timelinePending: {
    marginTop: 3,
    fontSize: 11,
    color: "#aaa",
  },

  items: {
    gap: 14,
  },

  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#e4e0d9",
  },

  itemInfo: {
    flex: 1,
  },

  itemName: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    color: "#222",
  },

  itemQuantity: {
    marginTop: 4,
    fontSize: 11,
    color: "#777",
  },

  itemTotal: {
    fontSize: 13,
    fontWeight: "600",
    color: "#222",
  },

  address: {
    gap: 4,
  },

  addressName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#222",
    marginBottom: 2,
  },

  addressText: {
    fontSize: 13,
    color: "#555",
  },

  addressPhone: {
    marginTop: 7,
    fontSize: 13,
    color: "#555",
  },

  note: {
    fontSize: 13,
    lineHeight: 20,
    color: "#666",
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 15,
    marginBottom: 11,
  },

  detailLabel: {
    fontSize: 13,
    color: "#777",
  },

  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    textAlign: "right",
  },

  divider: {
    height: 1,
    marginVertical: 5,
    backgroundColor: "#e4e0d9",
  },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 7,
  },

  totalLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: "#222",
  },

  totalValue: {
    fontSize: 19,
    fontWeight: "700",
    color: "#222",
  },

  primaryButton: {
    marginTop: 8,
    borderRadius: 13,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: "#111",
  },

  primaryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  errorTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#222",
  },

  errorMessage: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    color: "#777",
  },
});
