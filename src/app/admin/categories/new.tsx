import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

import SiteHeader from "@/components/SiteHeader";
import { STORE } from "@/constants/store";
import { supabase } from "@/lib/supabase";

function createSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
}

export default function NewCategoryPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const slug = createSlug(name);

  async function handleSave() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      Alert.alert("Category name required", "Please enter a category name.");
      return;
    }

    setSaving(true);

    try {
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

      if (profileError || profile?.role !== "admin") {
        router.replace("/");
        return;
      }

      // Match the web API:
      // category names are case-insensitively unique.
      const { data: existing, error: existingError } = await supabase
        .from("categories")
        .select("id")
        .ilike("name", trimmedName)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existing) {
        Alert.alert(
          "Category already exists",
          "A category with this name already exists.",
        );
        return;
      }

      const generatedSlug = createSlug(trimmedName);

      if (!generatedSlug) {
        Alert.alert(
          "Invalid category name",
          "Please enter a category name containing letters or numbers.",
        );
        return;
      }

      // Check slug as well before inserting.
      const { data: existingSlug, error: slugError } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", generatedSlug)
        .maybeSingle();

      if (slugError) {
        throw slugError;
      }

      if (existingSlug) {
        Alert.alert(
          "Slug already exists",
          "Another category already uses this generated slug. Please choose a different name.",
        );
        return;
      }

      const { error: insertError } = await supabase
        .from("categories")
        .insert({
          name: trimmedName,
          slug: generatedSlug,
        });

      if (insertError) {
        throw insertError;
      }

      router.replace("/admin/categories");
    } catch (error) {
      console.log("Create category error:", error);

      Alert.alert(
        "Unable to create category",
        error instanceof Error
          ? error.message
          : "Failed to create category.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <SiteHeader />

      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* HEADER */}

          <View style={styles.pageHeader}>
            <Text style={styles.title}>New Category</Text>

            <Text style={styles.subtitle}>
              Create a category for your products.
            </Text>
          </View>

          {/* CATEGORY DETAILS */}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Category Details</Text>

            <Text style={styles.cardDescription}>
              Enter the category name. The URL slug will be generated
              automatically.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Category Name</Text>

              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Jewellery"
                placeholderTextColor="#aaa49b"
                editable={!saving}
                autoCapitalize="words"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Slug</Text>

              <View style={styles.slugBox}>
                <Text
                  style={[
                    styles.slugText,
                    !slug && styles.slugPlaceholder,
                  ]}
                >
                  {slug || "jewellery"}
                </Text>
              </View>

              <Text style={styles.helpText}>
                Generated automatically from the category name.
              </Text>
            </View>
          </View>

          {/* ACTIONS */}

          <View style={styles.actions}>
            <Pressable
              style={[
                styles.cancelButton,
                saving && styles.disabledButton,
              ]}
              onPress={() => router.back()}
              disabled={saving}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[
                styles.saveButton,
                (!name.trim() || saving) && styles.disabledSaveButton,
              ]}
              onPress={handleSave}
              disabled={!name.trim() || saving}
            >
              {saving ? (
                <>
                  <ActivityIndicator
                    size="small"
                    color="#ffffff"
                  />

                  <Text style={styles.saveButtonText}>Adding...</Text>
                </>
              ) : (
                <Text style={styles.saveButtonText}>Add Category</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: STORE.colors.background,
  },

  keyboardAvoiding: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
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

  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d8d5cf",
    backgroundColor: "#fffdf9",
    padding: 18,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#292824",
  },

  cardDescription: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: "#716d66",
  },

  field: {
    marginTop: 22,
  },

  label: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "700",
    color: "#4d4942",
  },

  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#d8d5cf",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#292824",
  },

  slugBox: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#e1ddd5",
    borderRadius: 12,
    backgroundColor: "#f5f2ec",
    paddingHorizontal: 14,
    justifyContent: "center",
  },

  slugText: {
    fontSize: 14,
    color: "#5f594f",
  },

  slugPlaceholder: {
    color: "#aaa49b",
  },

  helpText: {
    marginTop: 7,
    fontSize: 11,
    lineHeight: 16,
    color: "#8b857b",
  },

  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },

  cancelButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8d5cf",
    backgroundColor: "#fffdf9",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4d4942",
  },

  saveButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: "#292824",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  saveButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },

  disabledButton: {
    opacity: 0.5,
  },

  disabledSaveButton: {
    opacity: 0.45,
  },
});