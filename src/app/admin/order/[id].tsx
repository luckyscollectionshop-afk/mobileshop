import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { STORE } from "@/constants/store";
import { supabase } from "@/lib/supabase";

type OrderItem = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number | string;
  total_price: number | string;
  weight_grams: number | null;
  size: string | null;
  height: number | null;
  width: number | null;
  depth: number | null;
};

type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_method: string;
  payment_status: string;
  subtotal: number | string;
  shipping_cost: number | string;
  total: number | string;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_postal_code: string;
  shipping_country: string;
  customer_note: string | null;
  payment_verified_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  order_items: OrderItem[];
};

const statusOptions = [
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

type OrderStatus = (typeof statusOptions)[number];

export default function AdminOrderDetailPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();

  const orderId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null,
  );

  useFocusEffect(
    useCallback(() => {
      loadOrder();
    }, [orderId]),
  );

  async function loadOrder() {
    if (!orderId) {
      setErrorMessage("Order ID is missing.");
      setLoading(false);
      return;
    }

    try {
      setErrorMessage(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      // -------------------------------------------------------
      // Verify admin
      // -------------------------------------------------------

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

      if (profileError) {
        throw new Error(profileError.message);
      }

      if (profile?.role !== "admin") {
        router.replace("/");
        return;
      }

      // -------------------------------------------------------
      // Load order
      // -------------------------------------------------------

      const { data, error } = await supabase
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
            payment_verified_at,
            shipped_at,
            delivered_at,
            created_at,
            updated_at,
            order_items (
              id,
              product_name,
              quantity,
              unit_price,
              total_price,
              weight_grams,
              size,
              height,
              width,
              depth
            )
          `,
        )
        .eq("id", orderId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        throw new Error("Order not found.");
      }

      setOrder(data as Order);
    } catch (error) {
      console.log("Unable to load admin order:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load order.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadOrder();
  }

  function formatDate(date: string | null) {
    if (!date) return "Not yet";

    return new Date(date).toLocaleString("en-CH");
  }

  function formatLongDate(date: string) {
    return new Date(date).toLocaleDateString("en-CH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function formatMoney(value: number | string) {
    return `CHF ${Number(value).toFixed(2)}`;
  }

  function paymentLabel(method: string) {
    return method === "twint" ? "TWINT" : "Bank Transfer";
  }

  async function updatePaymentStatus(
    newPaymentStatus: "pending" | "paid",
  ) {
    if (!order || updatingPayment) return;

    setUpdatingPayment(true);

    try {
      /*
       * IMPORTANT:
       * For now this updates Supabase directly.
       * We will connect this to the same notification logic
       * used by the web shop after the screen itself is green.
       */

      const updateData: {
        payment_status: string;
        payment_verified_at: string | null;
        status?: string;
      } = {
        payment_status: newPaymentStatus,
        payment_verified_at:
          newPaymentStatus === "paid"
            ? new Date().toISOString()
            : null,
      };

      if (
        newPaymentStatus === "paid" &&
        order.status === "pending_payment"
      ) {
        updateData.status = "processing";
      }

      if (
        newPaymentStatus === "pending" &&
        order.status === "processing"
      ) {
        updateData.status = "pending_payment";
      }

      const { error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", order.id);

      if (error) {
        throw new Error(error.message);
      }

      await loadOrder();
    } catch (error) {
      Alert.alert(
        "Payment update failed",
        error instanceof Error
          ? error.message
          : "Unable to update payment status.",
      );
    } finally {
      setUpdatingPayment(false);
    }
  }

  async function updateOrderStatus(
    newStatus: OrderStatus,
  ) {
    if (!order || updatingStatus) return;

    if (
      newStatus !== "cancelled" &&
      order.payment_status !== "paid"
    ) {
      Alert.alert(
        "Payment required",
        "Verify the payment before processing this order.",
      );
      return;
    }

    setUpdatingStatus(true);

    try {
      const now = new Date().toISOString();

      const updateData: {
        status: OrderStatus;
        shipped_at: string | null;
        delivered_at: string | null;
      } = {
        status: newStatus,
        shipped_at: null,
        delivered_at: null,
      };

      if (newStatus === "shipped") {
        updateData.shipped_at = now;
      }

      if (newStatus === "delivered") {
        updateData.shipped_at = now;
        updateData.delivered_at = now;
      }

      const { error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", order.id);

      if (error) {
        throw new Error(error.message);
      }

      await loadOrder();
    } catch (error) {
      Alert.alert(
        "Status update failed",
        error instanceof Error
          ? error.message
          : "Unable to update order status.",
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "bottom"]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />

          <Text style={styles.loadingText}>
            Loading order...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage || !order) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "bottom"]}
      >
        <View style={styles.errorScreen}>
          <Text style={styles.errorTitle}>
            Unable to load order
          </Text>

          <Text style={styles.errorText}>
            {errorMessage ?? "Order not found."}
          </Text>

          <Pressable
            onPress={() => router.back()}
            style={styles.darkButton}
          >
            <Text style={styles.darkButtonText}>
              Back to orders
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const canChangeStatus =
    order.payment_status === "paid" ||
    order.status === "cancelled";

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={[ "bottom"]}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
      >
        {/* =====================================================
            HEADER
           ===================================================== */}

        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backText}>
              ← Back to orders
            </Text>
          </Pressable>

          <Text style={styles.title}>
            Order {order.order_number}
          </Text>

          <Text style={styles.placedDate}>
            Placed on {formatLongDate(order.created_at)}
          </Text>

          <View style={styles.headerBadges}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {order.status}
              </Text>
            </View>

            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {order.payment_status}
              </Text>
            </View>
          </View>
        </View>

        {/* =====================================================
            ORDER ITEMS
           ===================================================== */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Order items
          </Text>

          <View style={styles.itemsContainer}>
            {order.order_items?.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.item,
                  index === order.order_items.length - 1 &&
                    styles.lastItem,
                ]}
              >
                <View style={styles.itemTopRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>
                      {item.product_name}
                    </Text>

                    <Text style={styles.itemPrice}>
                      {formatMoney(item.unit_price)} ×{" "}
                      {item.quantity}
                    </Text>
                  </View>

                  <Text style={styles.itemTotal}>
                    {formatMoney(item.total_price)}
                  </Text>
                </View>

                <View style={styles.itemDetails}>
                  {item.weight_grams != null && (
                    <Text style={styles.itemDetail}>
                      Weight: {Number(item.weight_grams)} g
                    </Text>
                  )}

                  {item.size ? (
                    <Text style={styles.itemDetail}>
                      Size: {item.size}
                    </Text>
                  ) : null}

                  {item.height != null &&
                  item.width != null &&
                  item.depth != null ? (
                    <Text style={styles.itemDetail}>
                      Dimensions:{" "}
                      {Number(item.height)} ×{" "}
                      {Number(item.width)} ×{" "}
                      {Number(item.depth)}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* =====================================================
            CUSTOMER & SHIPPING
           ===================================================== */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Customer & shipping
          </Text>

          <View style={styles.infoBlock}>
            <Text style={styles.customerName}>
              {order.shipping_name}
            </Text>

            <Text style={styles.infoText}>
              {order.shipping_phone}
            </Text>

            <Text style={styles.address}>
              {order.shipping_address}
            </Text>

            <Text style={styles.infoText}>
              {order.shipping_postal_code}{" "}
              {order.shipping_city}
            </Text>

            <Text style={styles.infoText}>
              {order.shipping_country}
            </Text>
          </View>
        </View>

        {/* =====================================================
            CUSTOMER NOTE
           ===================================================== */}

        {order.customer_note ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Customer note
            </Text>

            <Text style={styles.note}>
              {order.customer_note}
            </Text>
          </View>
        ) : null}

        {/* =====================================================
            PAYMENT
           ===================================================== */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Payment
          </Text>

          <View style={styles.infoRows}>
            <View style={styles.infoRow}>
              <Text style={styles.label}>
                Method
              </Text>

              <Text style={styles.value}>
                {paymentLabel(order.payment_method)}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>
                Payment status
              </Text>

              <Text style={styles.value}>
                {order.payment_status}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>
                Verified
              </Text>

              <Text style={styles.value}>
                {order.payment_verified_at
                  ? formatDate(order.payment_verified_at)
                  : "Not verified"}
              </Text>
            </View>
          </View>

          {/* PAYMENT ACTION */}

          <View style={styles.actionArea}>
            {order.payment_status !== "paid" ? (
              <Pressable
                disabled={updatingPayment}
                onPress={() =>
                  updatePaymentStatus("paid")
                }
                style={[
                  styles.primaryButton,
                  updatingPayment &&
                    styles.disabledButton,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {updatingPayment
                    ? "Updating..."
                    : "Mark payment as paid"}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                disabled={updatingPayment}
                onPress={() =>
                  updatePaymentStatus("pending")
                }
                style={[
                  styles.secondaryButton,
                  updatingPayment &&
                    styles.disabledButton,
                ]}
              >
                <Text style={styles.secondaryButtonText}>
                  {updatingPayment
                    ? "Updating..."
                    : "Mark payment as pending"}
                </Text>
              </Pressable>
            )}
          </View>

          {/* STATUS ACTION */}

          {!canChangeStatus ? (
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>
                Order status
              </Text>

              <Text style={styles.warningText}>
                Verify the payment before processing
                this order.
              </Text>
            </View>
          ) : (
            <View style={styles.statusArea}>
              <Text style={styles.actionLabel}>
                Update order status
              </Text>

              <View style={styles.statusButtons}>
                {statusOptions.map((status) => (
                  <Pressable
                    key={status}
                    disabled={
                      updatingStatus ||
                      status === order.status
                    }
                    onPress={() =>
                      updateOrderStatus(status)
                    }
                    style={[
                      styles.statusButton,
                      status === order.status &&
                        styles.statusButtonActive,
                      (updatingStatus ||
                        status === order.status) &&
                        styles.statusButtonDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusButtonText,
                        status === order.status &&
                          styles.statusButtonTextActive,
                      ]}
                    >
                      {status}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.helperText}>
                You can change the status if an order
                was updated by mistake.
              </Text>
            </View>
          )}
        </View>

        {/* =====================================================
            ORDER SUMMARY
           ===================================================== */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Order summary
          </Text>

          <View style={styles.summaryRows}>
            <View style={styles.infoRow}>
              <Text style={styles.label}>
                Subtotal
              </Text>

              <Text style={styles.value}>
                {formatMoney(order.subtotal)}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>
                Shipping
              </Text>

              <Text style={styles.value}>
                {Number(order.shipping_cost) === 0
                  ? "Free"
                  : formatMoney(order.shipping_cost)}
              </Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Total
              </Text>

              <Text style={styles.totalValue}>
                {formatMoney(order.total)}
              </Text>
            </View>
          </View>
        </View>

        {/* =====================================================
            ORDER TIMELINE
           ===================================================== */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Order timeline
          </Text>

          <View style={styles.timeline}>
            <TimelineItem
              title="Order placed"
              value={formatDate(order.created_at)}
            />

            <TimelineItem
              title="Payment verified"
              value={formatDate(
                order.payment_verified_at,
              )}
            />

            <TimelineItem
              title="Shipped"
              value={formatDate(order.shipped_at)}
            />

            <TimelineItem
              title="Delivered"
              value={formatDate(order.delivered_at)}
              last
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* =========================================================
   TIMELINE ITEM
   ========================================================= */

function TimelineItem({
  title,
  value,
  last = false,
}: {
  title: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.timelineItem,
        last && styles.timelineItemLast,
      ]}
    >
      <View style={styles.timelineDot} />

      <View style={styles.timelineContent}>
        <Text style={styles.timelineTitle}>
          {title}
        </Text>

        <Text style={styles.timelineValue}>
          {value}
        </Text>
      </View>
    </View>
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

  container: {
    padding: 20,
    paddingBottom: 50,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6f6c66",
  },

  errorScreen: {
    flex: 1,
    padding: 25,
    alignItems: "center",
    justifyContent: "center",
  },

  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#292824",
  },

  errorText: {
    marginTop: 8,
    fontSize: 13,
    color: "#77736c",
    textAlign: "center",
  },

  darkButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#292824",
  },

  darkButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },

  header: {
    marginBottom: 22,
  },

  backButton: {
    alignSelf: "flex-start",
    marginBottom: 18,
  },

  backText: {
    fontSize: 14,
    color: "#6f6c66",
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#292824",
  },

  placedDate: {
    marginTop: 6,
    fontSize: 13,
    color: "#77736c",
  },

  headerBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 14,
  },

  badge: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#eeeae2",
  },

  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#55514a",
  },

  section: {
    backgroundColor: "#fffdf8",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d8d5cf",
    padding: 17,
    marginBottom: 15,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#292824",
  },

  itemsContainer: {
    marginTop: 15,
  },

  item: {
    paddingBottom: 15,
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e7e3dc",
  },

  lastItem: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },

  itemTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },

  itemInfo: {
    flex: 1,
  },

  itemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#292824",
  },

  itemPrice: {
    marginTop: 5,
    fontSize: 12,
    color: "#77736c",
  },

  itemTotal: {
    fontSize: 14,
    fontWeight: "600",
    color: "#292824",
  },

  itemDetails: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  itemDetail: {
    fontSize: 10,
    color: "#858078",
  },

  infoBlock: {
    marginTop: 14,
  },

  customerName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#292824",
  },

  infoText: {
    marginTop: 5,
    fontSize: 13,
    color: "#55514a",
  },

  address: {
    marginTop: 13,
    fontSize: 13,
    color: "#55514a",
  },

  note: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 20,
    color: "#55514a",
  },

  infoRows: {
    marginTop: 14,
    gap: 12,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 15,
  },

  label: {
    flex: 1,
    fontSize: 13,
    color: "#77736c",
  },

  value: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: "#292824",
    textAlign: "right",
  },

  actionArea: {
    marginTop: 18,
  },

  primaryButton: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "#292824",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
  },

  primaryButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },

  secondaryButton: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c9c5bd",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
  },

  secondaryButtonText: {
    color: "#292824",
    fontSize: 13,
    fontWeight: "600",
  },

  disabledButton: {
    opacity: 0.5,
  },

  warningBox: {
    marginTop: 15,
    padding: 13,
    borderRadius: 12,
    backgroundColor: "#f1eee8",
  },

  warningTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#292824",
  },

  warningText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: "#77736c",
  },

  statusArea: {
    marginTop: 18,
    paddingTop: 17,
    borderTopWidth: 1,
    borderTopColor: "#e7e3dc",
  },

  actionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#292824",
  },

  statusButtons: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d0ccc4",
    backgroundColor: "#fffdf8",
  },

  statusButtonActive: {
    backgroundColor: "#292824",
    borderColor: "#292824",
  },

  statusButtonDisabled: {
    opacity: 0.45,
  },

  statusButtonText: {
    fontSize: 11,
    color: "#55514a",
  },

  statusButtonTextActive: {
    color: "#fff",
    fontWeight: "600",
  },

  helperText: {
    marginTop: 9,
    fontSize: 10,
    lineHeight: 15,
    color: "#858078",
  },

  summaryRows: {
    marginTop: 15,
    gap: 13,
  },

  totalRow: {
    marginTop: 3,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#e1ddd5",
    flexDirection: "row",
    justifyContent: "space-between",
  },

  totalLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#292824",
  },

  totalValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#292824",
  },

  timeline: {
    marginTop: 16,
  },

  timelineItem: {
    minHeight: 62,
    flexDirection: "row",
  },

  timelineItemLast: {
    minHeight: 45,
  },

  timelineDot: {
    width: 9,
    height: 9,
    marginTop: 4,
    marginRight: 12,
    borderRadius: 5,
    backgroundColor: "#8c7650",
  },

  timelineContent: {
    flex: 1,
  },

  timelineTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#292824",
  },

  timelineValue: {
    marginTop: 4,
    fontSize: 11,
    color: "#858078",
  },
});