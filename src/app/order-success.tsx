import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { STORE } from "@/constants/store";

export default function OrderSuccessScreen() {
  const router = useRouter();

  const { order } = useLocalSearchParams<{
    order?: string;
  }>();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Success icon */}
        <View style={styles.successCircle}>
          <Text style={styles.checkmark}>✓</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>
          Thank you for your order!
        </Text>

        <Text style={styles.subtitle}>
          Your order has been placed successfully.
        </Text>

        {/* Order information */}
        {order ? (
          <View style={styles.orderCard}>
            <Text style={styles.orderLabel}>
              Order number
            </Text>

            <Text style={styles.orderNumber}>
              {order}
            </Text>
          </View>
        ) : null}

        {/* Payment message */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Your order is now awaiting payment verification.
          </Text>

          <Text style={styles.infoText}>
            Please complete your payment using the payment
            details shown during checkout. Your order will be
            confirmed after the payment has been verified.
          </Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttons}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.replace("/orders")}
          >
            <Text style={styles.primaryButtonText}>
              View my orders
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.replace("/explore")}
          >
            <Text style={styles.secondaryButtonText}>
              Continue shopping
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: STORE.colors.background,
  },

  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 30,
  },

  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(189,150,80,0.12)",
  },

  checkmark: {
    fontSize: 32,
    fontWeight: "700",
    color: "#bd9650",
  },

  title: {
    marginTop: 22,
    textAlign: "center",
    fontSize: 28,
    fontWeight: "700",
    color: "#222",
  },

  subtitle: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    color: "#777",
  },

  orderCard: {
    width: "100%",
    marginTop: 28,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ddd8cf",
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
  },

  orderLabel: {
    fontSize: 12,
    color: "#777",
  },

  orderNumber: {
    marginTop: 6,
    fontSize: 17,
    fontWeight: "700",
    color: "#222",
  },

  infoCard: {
    width: "100%",
    marginTop: 14,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.4)",
  },

  infoText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#666",
    textAlign: "center",
  },

  buttons: {
    width: "100%",
    marginTop: 28,
    gap: 10,
  },

  primaryButton: {
    borderRadius: 13,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: "#111",
  },

  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  secondaryButton: {
    borderRadius: 13,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d8d4cc",
    backgroundColor: "rgba(255,255,255,0.5)",
  },

  secondaryButtonText: {
    color: "#222",
    fontSize: 14,
    fontWeight: "600",
  },
});