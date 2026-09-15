
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { supabase } from "@/lib/supabase";
import { STORE } from "@/constants/store";

export default function ResetPasswordScreen() {
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* =========================================================
     CHECK RESET SESSION
     ========================================================= */

  useEffect(() => {
    async function checkSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setError(
            "This password reset link is invalid or has expired. Please request a new one.",
          );
        }
      } catch (err) {
        console.error("Reset session error:", err);

        setError(
          "Unable to verify the password reset link. Please request a new one.",
        );
      } finally {
        setCheckingSession(false);
      }
    }

    checkSession();
  }, []);

  /* =========================================================
     UPDATE PASSWORD
     ========================================================= */

  async function handleUpdatePassword() {
    setError("");
    setSuccess("");

    if (!newPassword || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const { error: updateError } =
        await supabase.auth.updateUser({
          password: newPassword,
        });

      if (updateError) {
        throw updateError;
      }

      setSuccess(
        "Your password has been updated successfully.",
      );

      /*
       * Give the user a moment to see the success message,
       * then return to Sign in.
       */
      setTimeout(async () => {
        await supabase.auth.signOut();
        router.replace("/auth/login");
      }, 1200);
    } catch (err: any) {
      console.error("Update password error:", err);

      setError(
        err?.message ||
          "Unable to update your password. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     CHECKING RESET SESSION
     ========================================================= */

  if (checkingSession) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator
          size="large"
          color={STORE.colors.primary}
        />

        <Text style={styles.loadingText}>
          Verifying password reset...
        </Text>
      </SafeAreaView>
    );
  }

  /* =========================================================
     SCREEN
     ========================================================= */

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* =================================================
              BRAND
              ================================================= */}

          <View style={styles.brandSection}>
            <Text style={styles.brandName}>
              {STORE.name}
            </Text>

            <View style={styles.goldLine} />
          </View>

          {/* =================================================
              CARD
              ================================================= */}

          <View style={styles.card}>
            <Text style={styles.title}>
              Reset your password
            </Text>

            <Text style={styles.subtitle}>
              Create a new password for your account.
            </Text>

            {/* =================================================
                NEW PASSWORD
                ================================================= */}

            <View style={styles.field}>
              <Text style={styles.label}>
                New password
              </Text>

              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter your new password"
                placeholderTextColor={STORE.colors.mutedText}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                style={styles.input}
                editable={!loading && !success}
              />
            </View>

            {/* =================================================
                CONFIRM PASSWORD
                ================================================= */}

            <View style={styles.field}>
              <Text style={styles.label}>
                Confirm password
              </Text>

              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Enter your password again"
                placeholderTextColor={STORE.colors.mutedText}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                style={styles.input}
                editable={!loading && !success}
              />
            </View>

            {/* =================================================
                ERROR
                ================================================= */}

            {error ? (
              <View style={styles.messageBox}>
                <Text style={styles.errorText}>
                  {error}
                </Text>
              </View>
            ) : null}

            {/* =================================================
                SUCCESS
                ================================================= */}

            {success ? (
              <View style={styles.messageBox}>
                <Text style={styles.successText}>
                  {success}
                </Text>
              </View>
            ) : null}

            {/* =================================================
                UPDATE PASSWORD
                ================================================= */}

            {!success ? (
              <Pressable
                onPress={handleUpdatePassword}
                disabled={loading || !!error}
                style={({ pressed }) => [
                  styles.updateButton,
                  pressed && styles.buttonPressed,
                  (loading || !!error) &&
                    styles.buttonDisabled,
                ]}
              >
                {loading ? (
                  <ActivityIndicator
                    color={STORE.colors.surface}
                  />
                ) : (
                  <Text style={styles.updateButtonText}>
                    Update password
                  </Text>
                )}
              </Pressable>
            ) : null}

            {/* =================================================
                BACK TO SIGN IN
                ================================================= */}

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>
                Remember your password?
              </Text>

              <Pressable
                onPress={() =>
                  router.replace("/auth/login")
                }
                disabled={loading}
              >
                <Text style={styles.loginLink}>
                  Sign in
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: STORE.colors.background,
  },

  loadingText: {
    marginTop: 10,
    color: STORE.colors.mutedText,
  },

  keyboardView: {
    flex: 1,
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 35,
    justifyContent: "center",
  },

  /* =======================================================
     BRAND
     ======================================================= */

  brandSection: {
    alignItems: "center",
    marginBottom: 28,
  },

  brandName: {
    fontSize: 27,
    fontWeight: "700",
    color: STORE.colors.text,
    textAlign: "center",
  },

  goldLine: {
    width: 55,
    height: 3,
    borderRadius: 3,
    backgroundColor: STORE.colors.primary,
    marginTop: 10,
  },

  /* =======================================================
     CARD
     ======================================================= */

  card: {
    backgroundColor: STORE.colors.surface,
    borderWidth: 1,
    borderColor: STORE.colors.border,
    borderRadius: 22,
    padding: 24,
  },

  title: {
    fontSize: 27,
    fontWeight: "700",
    color: STORE.colors.text,
  },

  subtitle: {
    fontSize: 15,
    color: STORE.colors.mutedText,
    marginTop: 6,
    marginBottom: 26,
    lineHeight: 21,
  },

  /* =======================================================
     FIELDS
     ======================================================= */

  field: {
    marginBottom: 18,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    color: STORE.colors.text,
    marginBottom: 7,
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: STORE.colors.border,
    borderRadius: 12,
    backgroundColor: STORE.colors.background,
    paddingHorizontal: 15,
    fontSize: 15,
    color: STORE.colors.text,
  },

  /* =======================================================
     MESSAGES
     ======================================================= */

  messageBox: {
    marginBottom: 16,
  },

  errorText: {
    fontSize: 14,
    color: "#B3261E",
    lineHeight: 20,
  },

  successText: {
    fontSize: 14,
    color: "#287A3E",
    lineHeight: 20,
  },

  /* =======================================================
     BUTTON
     ======================================================= */

  updateButton: {
    height: 50,
    borderRadius: 12,
    backgroundColor: STORE.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  updateButtonText: {
    color: STORE.colors.surface,
    fontSize: 16,
    fontWeight: "700",
  },

  buttonPressed: {
    opacity: 0.8,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  /* =======================================================
     LOGIN
     ======================================================= */

  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 25,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: STORE.colors.border,
  },

  loginText: {
    fontSize: 14,
    color: STORE.colors.mutedText,
  },

  loginLink: {
    fontSize: 14,
    color: STORE.colors.primary,
    fontWeight: "700",
    marginLeft: 5,
  },
});
