import { useState } from "react";
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

export default function SignupScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSignup() {
    setError("");
    setSuccess("");

    const cleanEmail = email.trim();

    if (!cleanEmail || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const {
        data: signupData,
        error: signupError,
      } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (signupError) {
        throw signupError;
      }

      /*
       * If Supabase requires email confirmation,
       * session will normally be null here.
       */

      if (!signupData.session) {
        setSuccess(
          "Account created successfully. Please check your email to confirm your account.",
        );

        return;
      }

      setSuccess("Account created successfully.");

      setTimeout(() => {
        router.replace("/");
      }, 500);
    } catch (err: any) {
      console.error("Signup error:", err);

      setError(
        err?.message ||
          "Unable to create your account. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

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
              SIGNUP CARD
              ================================================= */}

          <View style={styles.card}>
            <Text style={styles.title}>
              Create your account
            </Text>

            <Text style={styles.subtitle}>
              Join {STORE.name}
            </Text>

            {/* =================================================
                EMAIL
                ================================================= */}

            <View style={styles.field}>
              <Text style={styles.label}>
                Email
              </Text>

              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor={
                  STORE.colors.mutedText
                }
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                style={styles.input}
                editable={!loading}
              />
            </View>

            {/* =================================================
                PASSWORD
                ================================================= */}

            <View style={styles.field}>
              <Text style={styles.label}>
                Password
              </Text>

              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Create a password"
                placeholderTextColor={
                  STORE.colors.mutedText
                }
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                style={styles.input}
                editable={!loading}
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
                placeholderTextColor={
                  STORE.colors.mutedText
                }
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                style={styles.input}
                editable={!loading}
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
                CREATE ACCOUNT
                ================================================= */}

            <Pressable
              onPress={handleSignup}
              disabled={loading}
              style={({ pressed }) => [
                styles.signupButton,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator
                  color={STORE.colors.surface}
                />
              ) : (
                <Text style={styles.signupButtonText}>
                  Create account
                </Text>
              )}
            </Pressable>

            {/* =================================================
                LOGIN LINK
                ================================================= */}

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>
                Already have an account?
              </Text>

              <Pressable
                onPress={() => router.replace("/auth/login")}
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

  signupButton: {
    height: 50,
    borderRadius: 12,
    backgroundColor: STORE.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  signupButtonText: {
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