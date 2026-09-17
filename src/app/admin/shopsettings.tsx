import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { STORE } from "@/constants/store";
import { supabase } from "@/lib/supabase";

// ==========================================================
// TYPES
// ==========================================================

type HeroMedia = {
  url: string;
  type: "image" | "video";
};

type Category = {
  id: string;
  name: string;
};

type SocialLink = {
  id: string;
  name: string;
  url: string;
  icon_url: string;
};

type SiteSettings = {
  theme: "golden" | "light" | "dark";
  hero_title: string;
  hero_description: string;
  hero_media: HeroMedia[] | null;
  homepage_category_ids: string[] | null;
};

type StorefrontSettings = {
  id: string;

  social_enabled: boolean;
  social_links: SocialLink[];

  twint_enabled: boolean;
  twint_phone: string | null;

  bank_transfer_enabled: boolean;
  bank_account_name: string | null;
  bank_iban: string | null;

  shipping_enabled: boolean;
  shipping_method: string | null;
  shipping_price: number;
  free_shipping: boolean;

  store_name: string | null;
  store_address: string | null;
  store_city: string | null;
  store_postal_code: string | null;
  store_country: string | null;
};

const ALL_PRODUCTS_ID = "__all__";
const PREBOOKING_ID = "__prebooking__";

// ==========================================================
// SCREEN
// ==========================================================

export default function ShopSettingsScreen() {
  const router = useRouter();

  // --------------------------------------------------------
  // LOADING / SAVING
  // --------------------------------------------------------

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingMedia, setDeletingMedia] = useState(false);

  // --------------------------------------------------------
  // SITE SETTINGS
  // --------------------------------------------------------

  const [theme, setTheme] =
    useState<SiteSettings["theme"]>("golden");

  const [title, setTitle] = useState(
    "Something beautiful, just for you.",
  );

  const [description, setDescription] = useState(
    "Discover jewellery, traditional treasures and delicious favourites, thoughtfully brought together for you.",
  );

  const [media, setMedia] = useState<HeroMedia[]>([]);

  const [categories, setCategories] = useState<Category[]>([]);

  const [homepageCategoryIds, setHomepageCategoryIds] =
    useState<string[]>([]);

  // --------------------------------------------------------
  // SOCIAL
  // --------------------------------------------------------

  const [socialEnabled, setSocialEnabled] = useState(true);

  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);

  // --------------------------------------------------------
  // PAYMENT
  // --------------------------------------------------------

  const [twintEnabled, setTwintEnabled] = useState(false);

  const [twintPhone, setTwintPhone] = useState("");

  const [bankTransferEnabled, setBankTransferEnabled] =
    useState(false);

  const [bankAccountName, setBankAccountName] =
    useState("");

  const [bankIban, setBankIban] = useState("");

  // --------------------------------------------------------
  // SHIPPING
  // --------------------------------------------------------

  const [shippingEnabled, setShippingEnabled] =
    useState(true);

  const [shippingMethod, setShippingMethod] =
    useState("");

  const [shippingPrice, setShippingPrice] =
    useState("0");

  const [freeShipping, setFreeShipping] =
    useState(false);

  // --------------------------------------------------------
  // STORE
  // --------------------------------------------------------

  const [storeName, setStoreName] = useState("");

  const [storeAddress, setStoreAddress] =
    useState("");

  const [storeCity, setStoreCity] = useState("");

  const [storePostalCode, setStorePostalCode] =
    useState("");

  const [storeCountry, setStoreCountry] =
    useState("Switzerland");

  // ========================================================
  // LOAD
  // ========================================================

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);

      // ----------------------------------------------------
      // CHECK LOGIN
      // ----------------------------------------------------

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      // ----------------------------------------------------
      // CHECK ADMIN
      // ----------------------------------------------------

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (profile?.role !== "admin") {
        Alert.alert(
          "Access denied",
          "Only administrators can edit shop settings.",
          [
            {
              text: "OK",
              onPress: () => router.replace("/"),
            },
          ],
        );

        return;
      }

      // ----------------------------------------------------
      // LOAD EVERYTHING
      // ----------------------------------------------------

      const [
        { data: siteSettings, error: siteError },
        { data: categoryData, error: categoryError },
        {
          data: storefrontSettings,
          error: storefrontError,
        },
      ] = await Promise.all([
        supabase
          .from("site_settings")
          .select(
            "theme, hero_title, hero_description, hero_media, homepage_category_ids",
          )
          .eq("id", true)
          .maybeSingle(),

        supabase
          .from("categories")
          .select("id, name")
          .eq("is_active", true)
          .order("sort_order")
          .order("name"),

        supabase
          .from("storefront_settings")
          .select("*")
          .maybeSingle(),
      ]);

      if (siteError) {
        throw siteError;
      }

      if (categoryError) {
        throw categoryError;
      }

      if (storefrontError) {
        throw storefrontError;
      }

      // ----------------------------------------------------
      // SITE
      // ----------------------------------------------------

      if (siteSettings) {
        const settings = siteSettings as SiteSettings;

        setTheme(settings.theme ?? "golden");

        setTitle(
          settings.hero_title ??
            "Something beautiful, just for you.",
        );

        setDescription(
          settings.hero_description ??
            "Discover jewellery, traditional treasures and delicious favourites, thoughtfully brought together for you.",
        );

        setMedia(settings.hero_media ?? []);

        setHomepageCategoryIds(
          settings.homepage_category_ids ?? [],
        );
      }

      // ----------------------------------------------------
      // CATEGORIES
      // ----------------------------------------------------

      setCategories(
        (categoryData ?? []) as Category[],
      );

      // ----------------------------------------------------
      // STOREFRONT
      // ----------------------------------------------------

      if (storefrontSettings) {
        const storefront =
          storefrontSettings as StorefrontSettings;

        setSocialEnabled(
          storefront.social_enabled ?? true,
        );

        setSocialLinks(
          storefront.social_links ?? [],
        );

        setTwintEnabled(
          storefront.twint_enabled ?? false,
        );

        setTwintPhone(
          storefront.twint_phone ?? "",
        );

        setBankTransferEnabled(
          storefront.bank_transfer_enabled ?? false,
        );

        setBankAccountName(
          storefront.bank_account_name ?? "",
        );

        setBankIban(
          storefront.bank_iban ?? "",
        );

        setShippingEnabled(
          storefront.shipping_enabled ?? true,
        );

        setShippingMethod(
          storefront.shipping_method ?? "",
        );

        setShippingPrice(
          String(
            storefront.shipping_price ?? 0,
          ),
        );

        setFreeShipping(
          storefront.free_shipping ?? false,
        );

        setStoreName(
          storefront.store_name ?? "",
        );

        setStoreAddress(
          storefront.store_address ?? "",
        );

        setStoreCity(
          storefront.store_city ?? "",
        );

        setStorePostalCode(
          storefront.store_postal_code ?? "",
        );

        setStoreCountry(
          storefront.store_country ?? "Switzerland",
        );
      }
    } catch (error) {
      console.error(
        "Load shop settings error:",
        error,
      );

      Alert.alert(
        "Shop settings",
        error instanceof Error
          ? error.message
          : "Failed to load shop settings.",
      );
    } finally {
      setLoading(false);
    }
  }

  // ========================================================
  // HERO MEDIA UPLOAD
  // ========================================================

  async function pickAndUploadHeroMedia() {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission required",
          "Please allow photo library access to select hero media.",
        );

        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images", "videos"],
          allowsMultipleSelection: true,
          quality: 0.9,
        });

      if (result.canceled || !result.assets.length) {
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        Alert.alert(
          "Sign in required",
          "Your admin session has expired. Please sign in again.",
        );

        router.replace("/auth/login");
        return;
      }

      setUploading(true);

      const uploaded: HeroMedia[] = [];

      for (const asset of result.assets) {
        const fileName =
          asset.fileName ??
          `hero-${Date.now()}`;

        const mimeType =
          asset.mimeType ??
          "image/jpeg";

        const file = new File(asset.uri);

        const formData = new FormData();

        formData.append("file", file);
        formData.append("folder", "hero");

        const response = await fetch(
          `${process.env.EXPO_PUBLIC_WEB_API_URL}/api/upload`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            body: formData,
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ??
              `Failed to upload ${fileName}.`,
          );
        }

        if (!data?.url) {
          throw new Error(
            "Cloudinary did not return a media URL.",
          );
        }

        uploaded.push({
          url: data.url,
          type: mimeType.startsWith("video/")
            ? "video"
            : "image",
        });
      }

      setMedia((current) => [
        ...current,
        ...uploaded,
      ]);

      Alert.alert(
        "Media uploaded",
        "The new hero media has been uploaded. Tap Save Storefront to keep the changes.",
      );
    } catch (error) {
      console.error(
        "Hero media upload error:",
        error,
      );

      Alert.alert(
        "Upload failed",
        error instanceof Error
          ? error.message
          : "Could not upload hero media.",
      );
    } finally {
      setUploading(false);
    }
  }

  // ========================================================
  // DELETE HERO MEDIA
  // ========================================================

  async function deleteCloudinaryImage(
    url: string,
    accessToken: string,
  ) {
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_WEB_API_URL}/api/admin/cloudinary/delete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          url,
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ??
          "Failed to delete media from Cloudinary.",
      );
    }

    return data;
  }

  function removeHeroMedia(index: number) {
    const item = media[index];

    if (!item) {
      return;
    }

    Alert.alert(
      "Remove hero media",
      "Remove this media from the hero carousel?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingMedia(true);

              const {
                data: { session },
              } = await supabase.auth.getSession();

              if (!session?.access_token) {
                throw new Error(
                  "Your admin session has expired. Please sign in again.",
                );
              }

              await deleteCloudinaryImage(
                item.url,
                session.access_token,
              );

              setMedia((current) =>
                current.filter(
                  (_, itemIndex) =>
                    itemIndex !== index,
                ),
              );
            } catch (error) {
              console.error(
                "Hero media deletion error:",
                error,
              );

              Alert.alert(
                "Remove failed",
                error instanceof Error
                  ? error.message
                  : "Could not remove hero media.",
              );
            } finally {
              setDeletingMedia(false);
            }
          },
        },
      ],
    );
  }

  // ========================================================
  // SOCIAL
  // ========================================================

  function addSocialLink() {
    setSocialLinks((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: "",
        url: "",
        icon_url: "",
      },
    ]);
  }

  function updateSocialLink(
    id: string,
    field: keyof SocialLink,
    value: string,
  ) {
    setSocialLinks((current) =>
      current.map((link) =>
        link.id === id
          ? {
              ...link,
              [field]: value,
            }
          : link,
      ),
    );
  }

  function removeSocialLink(id: string) {
    setSocialLinks((current) =>
      current.filter(
        (link) => link.id !== id,
      ),
    );
  }

  async function uploadSocialIcon(id: string) {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission required",
          "Please allow photo library access to select an icon.",
        );

        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: false,
          quality: 0.9,
        });

      if (
        result.canceled ||
        !result.assets.length
      ) {
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/auth/login");
        return;
      }

      setUploading(true);

      const asset = result.assets[0];

      const file = new File(asset.uri);

      const formData = new FormData();

      formData.append("file", file);
      formData.append("folder", "social");

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_WEB_API_URL}/api/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "Social icon upload failed.",
        );
      }

      updateSocialLink(
        id,
        "icon_url",
        data.url,
      );
    } catch (error) {
      console.error(
        "Social icon upload error:",
        error,
      );

      Alert.alert(
        "Upload failed",
        error instanceof Error
          ? error.message
          : "Could not upload social icon.",
      );
    } finally {
      setUploading(false);
    }
  }

  // ========================================================
  // HOMEPAGE STRIPS
  // ========================================================

  function toggleHomepageCategory(
    id: string,
    checked: boolean,
  ) {
    setHomepageCategoryIds((current) =>
      checked
        ? [...current, id]
        : current.filter(
            (item) => item !== id,
          ),
    );
  }

  function moveHomepageCategory(
    index: number,
    direction: "up" | "down",
  ) {
    setHomepageCategoryIds((current) => {
      const next = [...current];

      const targetIndex =
        direction === "up"
          ? index - 1
          : index + 1;

      if (
        targetIndex < 0 ||
        targetIndex >= next.length
      ) {
        return current;
      }

      [
        next[index],
        next[targetIndex],
      ] = [
        next[targetIndex],
        next[index],
      ];

      return next;
    });
  }

  function getHomepageLabel(id: string) {
    if (id === ALL_PRODUCTS_ID) {
      return "ALL PRODUCTS";
    }

    if (id === PREBOOKING_ID) {
      return "PREBOOKING";
    }

    return (
      categories.find(
        (category) => category.id === id,
      )?.name ?? "Unknown category"
    );
  }

  // ========================================================
  // SAVE
  // ========================================================

  async function saveSettings() {
    if (!title.trim()) {
      Alert.alert(
        "Shop settings",
        "Please provide a hero title.",
      );
      return;
    }

    if (!description.trim()) {
      Alert.alert(
        "Shop settings",
        "Please provide a hero description.",
      );
      return;
    }

    const numericShippingPrice =
      Number(shippingPrice);

    if (
      !Number.isFinite(
        numericShippingPrice,
      ) ||
      numericShippingPrice < 0
    ) {
      Alert.alert(
        "Shipping",
        "Please enter a valid shipping price.",
      );
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

      const { data: profile } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

      if (profile?.role !== "admin") {
        throw new Error(
          "Only administrators can save shop settings.",
        );
      }

      // ----------------------------------------------------
      // SITE SETTINGS
      // ----------------------------------------------------

      const {
        error: siteSettingsError,
      } = await supabase
        .from("site_settings")
        .upsert(
          {
            id: true,
            theme,
            hero_title: title.trim(),
            hero_description:
              description.trim(),
            hero_media: media,
            homepage_category_ids:
              homepageCategoryIds,
          },
          {
            onConflict: "id",
          },
        );

      if (siteSettingsError) {
        throw siteSettingsError;
      }

      // ----------------------------------------------------
      // STOREFRONT SETTINGS
      // ----------------------------------------------------

      const storefrontData = {
        social_enabled: socialEnabled,

        social_links: socialLinks,

        twint_enabled: twintEnabled,

        twint_phone:
          twintPhone.trim() || null,

        bank_transfer_enabled:
          bankTransferEnabled,

        bank_account_name:
          bankAccountName.trim() || null,

        bank_iban:
          bankIban.trim() || null,

        shipping_enabled:
          shippingEnabled,

        shipping_method:
          shippingMethod.trim() || null,

        shipping_price: freeShipping
          ? 0
          : numericShippingPrice,

        free_shipping:
          freeShipping,

        store_name:
          storeName.trim() || null,

        store_address:
          storeAddress.trim() || null,

        store_city:
          storeCity.trim() || null,

        store_postal_code:
          storePostalCode.trim() || null,

        store_country:
          storeCountry.trim() ||
          "Switzerland",
      };

      // ----------------------------------------------------
      // GET EXISTING STOREFRONT ROW
      // ----------------------------------------------------

      const {
        data: existingStorefront,
        error: storefrontLookupError,
      } = await supabase
        .from("storefront_settings")
        .select("id")
        .maybeSingle();

      if (storefrontLookupError) {
        throw storefrontLookupError;
      }

      const storefrontPayload =
        existingStorefront?.id
          ? {
              id: existingStorefront.id,
              ...storefrontData,
            }
          : storefrontData;

      const {
        error: storefrontError,
      } = await supabase
        .from("storefront_settings")
        .upsert(
          storefrontPayload,
          {
            onConflict: "id",
          },
        );

      if (storefrontError) {
        throw storefrontError;
      }

      Alert.alert(
        "Saved",
        "Storefront settings saved successfully.",
        [
          {
            text: "OK",
            onPress: () => {
              router.replace("/admin");
            },
          },
        ],
      );
    } catch (error) {
      console.error(
        "Save storefront settings error:",
        error,
      );

      Alert.alert(
        "Save failed",
        error instanceof Error
          ? error.message
          : "Failed to save storefront settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  // ========================================================
  // LOADING
  // ========================================================

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={STORE.colors.primary}
          />

          <Text style={styles.loadingText}>
            Loading shop settings...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ========================================================
  // UI
  // ========================================================

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "bottom"]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ==================================================
            HEADER
        ================================================== */}

        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() =>
              router.replace("/admin")
            }
          >
            <Text style={styles.backText}>
              ‹ Admin
            </Text>
          </Pressable>

          <Text style={styles.title}>
            Shop Settings
          </Text>

          <Text style={styles.subtitle}>
            Manage your storefront, homepage,
            payments and shipping.
          </Text>
        </View>

        {/* ==================================================
            COLOUR PALETTE
        ================================================== */}

        <Section title="Colour Palette">
          <Text style={styles.label}>
            Site mode
          </Text>

          <View style={styles.optionGroup}>
            {[
              {
                value: "golden" as const,
                label: "Golden",
                description:
                  "Warm and elegant",
              },
              {
                value: "light" as const,
                label: "Light",
                description:
                  "Clean and airy",
              },
              {
                value: "dark" as const,
                label: "Dark",
                description:
                  "Rich and modern",
              },
            ].map((option) => {
              const selected =
                theme === option.value;

              return (
                <Pressable
                  key={option.value}
                  style={[
                    styles.optionCard,
                    selected &&
                      styles.optionCardSelected,
                  ]}
                  onPress={() =>
                    setTheme(option.value)
                  }
                >
                  <View
                    style={[
                      styles.radio,
                      selected &&
                        styles.radioSelected,
                    ]}
                  >
                    {selected ? (
                      <View
                        style={
                          styles.radioDot
                        }
                      />
                    ) : null}
                  </View>

                  <View
                    style={
                      styles.optionText
                    }
                  >
                    <Text
                      style={
                        styles.optionTitle
                      }
                    >
                      {option.label}
                    </Text>

                    <Text
                      style={
                        styles.optionDescription
                      }
                    >
                      {option.description}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* ==================================================
            HERO
        ================================================== */}

        <Section title="Homepage Hero">
          <Field
            label="Hero Title"
            value={title}
            onChangeText={setTitle}
            placeholder="Something beautiful, just for you."
          />

          <Field
            label="Hero Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your shop..."
            multiline
          />

          <Text style={styles.label}>
            Hero Images / Videos
          </Text>

          {media.length > 0 ? (
            <View style={styles.mediaList}>
              {media.map((item, index) => (
                <View
                  key={`${item.url}-${index}`}
                  style={styles.mediaCard}
                >
                  {item.type ===
                  "image" ? (
                    <Image
                      source={{
                        uri: item.url,
                      }}
                      style={
                        styles.heroImage
                      }
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={
                        styles.videoPlaceholder
                      }
                    >
                      <Text
                        style={
                          styles.videoIcon
                        }
                      >
                        ▶
                      </Text>

                      <Text
                        style={
                          styles.videoText
                        }
                      >
                        Video
                      </Text>
                    </View>
                  )}

                  <View
                    style={
                      styles.mediaFooter
                    }
                  >
                    <Text
                      style={
                        styles.mediaType
                      }
                    >
                      {item.type}
                    </Text>

                    <Pressable
                      style={
                        styles.smallRemoveButton
                      }
                      onPress={() =>
                        removeHeroMedia(
                          index,
                        )
                      }
                      disabled={
                        deletingMedia ||
                        saving ||
                        uploading
                      }
                    >
                      <Text
                        style={
                          styles.smallRemoveText
                        }
                      >
                        Remove
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                No hero media added yet.
              </Text>
            </View>
          )}

          <Pressable
            style={styles.secondaryButton}
            onPress={
              pickAndUploadHeroMedia
            }
            disabled={
              uploading ||
              saving ||
              deletingMedia
            }
          >
            {uploading ? (
              <ActivityIndicator
                color={
                  STORE.colors.primary
                }
              />
            ) : (
              <Text
                style={
                  styles.secondaryButtonText
                }
              >
                + Add Hero Media
              </Text>
            )}
          </Pressable>

          <Text style={styles.helper}>
            Images and videos are uploaded to
            Cloudinary.
          </Text>
        </Section>

        {/* ==================================================
            HOMEPAGE PRODUCT STRIPS
        ================================================== */}

        <Section title="Homepage Product Strips">
          <Text style={styles.sectionDescription}>
            Select the product strips shown on the
            homepage and arrange their order.
          </Text>

          {homepageCategoryIds.length >
            0 && (
            <>
              <Text
                style={[
                  styles.label,
                  { marginTop: 12 },
                ]}
              >
                Homepage order
              </Text>

              <View
                style={
                  styles.orderList
                }
              >
                {homepageCategoryIds.map(
                  (id, index) => (
                    <View
                      key={id}
                      style={
                        styles.orderRow
                      }
                    >
                      <View
                        style={
                          styles.orderNumber
                        }
                      >
                        <Text
                          style={
                            styles.orderNumberText
                          }
                        >
                          {index + 1}
                        </Text>
                      </View>

                      <Text
                        style={
                          styles.orderLabel
                        }
                      >
                        {getHomepageLabel(
                          id,
                        )}
                      </Text>

                      <View
                        style={
                          styles.orderButtons
                        }
                      >
                        <Pressable
                          style={[
                            styles.arrowButton,
                            index ===
                              0 &&
                              styles.disabledButton,
                          ]}
                          disabled={
                            index === 0
                          }
                          onPress={() =>
                            moveHomepageCategory(
                              index,
                              "up",
                            )
                          }
                        >
                          <Text
                            style={
                              styles.arrowText
                            }
                          >
                            ↑
                          </Text>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.arrowButton,
                            index ===
                              homepageCategoryIds.length -
                                1 &&
                              styles.disabledButton,
                          ]}
                          disabled={
                            index ===
                            homepageCategoryIds.length -
                              1
                          }
                          onPress={() =>
                            moveHomepageCategory(
                              index,
                              "down",
                            )
                          }
                        >
                          <Text
                            style={
                              styles.arrowText
                            }
                          >
                            ↓
                          </Text>
                        </Pressable>

                        <Pressable
                          style={
                            styles.removeTextButton
                          }
                          onPress={() =>
                            toggleHomepageCategory(
                              id,
                              false,
                            )
                          }
                        >
                          <Text
                            style={
                              styles.removeText
                            }
                          >
                            Remove
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ),
                )}
              </View>
            </>
          )}

          <Text
            style={[
              styles.label,
              { marginTop: 18 },
            ]}
          >
            Add product strip
          </Text>

          <View
            style={
              styles.checkboxList
            }
          >
            <CheckboxRow
              label="ALL PRODUCTS"
              checked={homepageCategoryIds.includes(
                ALL_PRODUCTS_ID,
              )}
              onChange={(value) =>
                toggleHomepageCategory(
                  ALL_PRODUCTS_ID,
                  value,
                )
              }
            />

            <CheckboxRow
              label="PREBOOKING"
              checked={homepageCategoryIds.includes(
                PREBOOKING_ID,
              )}
              onChange={(value) =>
                toggleHomepageCategory(
                  PREBOOKING_ID,
                  value,
                )
              }
            />

            {categories.map(
              (category) => (
                <CheckboxRow
                  key={category.id}
                  label={category.name}
                  checked={homepageCategoryIds.includes(
                    category.id,
                  )}
                  onChange={(value) =>
                    toggleHomepageCategory(
                      category.id,
                      value,
                    )
                  }
                />
              ),
            )}
          </View>
        </Section>

        {/* ==================================================
            SOCIAL MEDIA
        ================================================== */}

        <Section title="Social Media">
          <DisplaySwitch
            label="Show social media on homepage"
            description="Display your social links below the homepage."
            value={socialEnabled}
            onValueChange={
              setSocialEnabled
            }
          />

          {socialEnabled && (
            <View
              style={
                styles.innerSpacing
              }
            >
              {socialLinks.map(
                (link, index) => (
                  <View
                    key={link.id}
                    style={
                      styles.socialCard
                    }
                  >
                    <View
                      style={
                        styles.socialHeader
                      }
                    >
                      <Text
                        style={
                          styles.socialTitle
                        }
                      >
                        Social Link{" "}
                        {index + 1}
                      </Text>

                      <Pressable
                        onPress={() =>
                          removeSocialLink(
                            link.id,
                          )
                        }
                      >
                        <Text
                          style={
                            styles.removeText
                          }
                        >
                          Remove
                        </Text>
                      </Pressable>
                    </View>

                    <Field
                      label="Name"
                      value={link.name}
                      onChangeText={(
                        value,
                      ) =>
                        updateSocialLink(
                          link.id,
                          "name",
                          value,
                        )
                      }
                      placeholder="Instagram"
                    />

                    <Field
                      label="Link"
                      value={link.url}
                      onChangeText={(
                        value,
                      ) =>
                        updateSocialLink(
                          link.id,
                          "url",
                          value,
                        )
                      }
                      placeholder="https://..."
                      autoCapitalize="none"
                    />

                    <Text
                      style={
                        styles.label
                      }
                    >
                      Icon
                    </Text>

                    <View
                      style={
                        styles.iconRow
                      }
                    >
                      {link.icon_url ? (
                        <Image
                          source={{
                            uri: link.icon_url,
                          }}
                          style={
                            styles.socialIcon
                          }
                        />
                      ) : (
                        <View
                          style={
                            styles.noIcon
                          }
                        >
                          <Text
                            style={
                              styles.noIconText
                            }
                          >
                            No icon
                          </Text>
                        </View>
                      )}

                      <Pressable
                        style={
                          styles.secondaryButton
                        }
                        onPress={() =>
                          uploadSocialIcon(
                            link.id,
                          )
                        }
                        disabled={
                          uploading ||
                          saving
                        }
                      >
                        <Text
                          style={
                            styles.secondaryButtonText
                          }
                        >
                          Upload Icon
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ),
              )}

              <Pressable
                style={
                  styles.outlineButton
                }
                onPress={
                  addSocialLink
                }
              >
                <Text
                  style={
                    styles.outlineButtonText
                  }
                >
                  + Add Social Link
                </Text>
              </Pressable>
            </View>
          )}
        </Section>

        {/* ==================================================
            PAYMENT
        ================================================== */}

        <Section title="Payment Methods">
          <DisplaySwitch
            label="Enable TWINT"
            description="Allow customers to pay using TWINT."
            value={twintEnabled}
            onValueChange={
              setTwintEnabled
            }
          />

          {twintEnabled && (
            <Field
              label="TWINT Phone Number"
              value={twintPhone}
              onChangeText={setTwintPhone}
              placeholder="+41 ..."
              keyboardType="phone-pad"
            />
          )}

          <View
            style={
              styles.divider
            }
          />

          <DisplaySwitch
            label="Enable Bank Transfer"
            description="Allow customers to pay by bank transfer."
            value={
              bankTransferEnabled
            }
            onValueChange={
              setBankTransferEnabled
            }
          />

          {bankTransferEnabled && (
            <>
              <Field
                label="Account Name"
                value={
                  bankAccountName
                }
                onChangeText={
                  setBankAccountName
                }
                placeholder="Account holder name"
              />

              <Field
                label="IBAN"
                value={bankIban}
                onChangeText={
                  setBankIban
                }
                placeholder="CH..."
                autoCapitalize="none"
              />
            </>
          )}
        </Section>

        {/* ==================================================
            SHIPPING
        ================================================== */}

        <Section title="Shipping">
          <DisplaySwitch
            label="Enable Shipping"
            description="Show shipping as an option during checkout."
            value={shippingEnabled}
            onValueChange={
              setShippingEnabled
            }
          />

          {shippingEnabled && (
            <>
              <Field
                label="Shipping Service"
                value={
                  shippingMethod
                }
                onChangeText={
                  setShippingMethod
                }
                placeholder="Swiss Post"
              />

              <Field
                label="Shipping Price (CHF)"
                value={
                  shippingPrice
                }
                onChangeText={
                  setShippingPrice
                }
                placeholder="0"
                keyboardType="decimal-pad"
              />

              <DisplaySwitch
                label="Free Shipping"
                description="Set shipping price to CHF 0."
                value={
                  freeShipping
                }
                onValueChange={
                  setFreeShipping
                }
              />
            </>
          )}
        </Section>

        {/* ==================================================
            STORE ADDRESS
        ================================================== */}

        <Section title="Store / Admin Address">
          <Text
            style={
              styles.sectionDescription
            }
          >
            This address can later be used for
            shipping and returns.
          </Text>

          <Field
            label="Store Name"
            value={storeName}
            onChangeText={
              setStoreName
            }
            placeholder="Lucky Charm Creation"
          />

          <Field
            label="Address"
            value={storeAddress}
            onChangeText={
              setStoreAddress
            }
            placeholder="Street and number"
          />

          <Field
            label="Postal Code"
            value={
              storePostalCode
            }
            onChangeText={
              setStorePostalCode
            }
            placeholder="5506"
            keyboardType="number-pad"
          />

          <Field
            label="City"
            value={storeCity}
            onChangeText={
              setStoreCity
            }
            placeholder="Mägenwil"
          />

          <Field
            label="Country"
            value={storeCountry}
            onChangeText={
              setStoreCountry
            }
            placeholder="Switzerland"
          />
        </Section>

        {/* ==================================================
            ACTIONS
        ================================================== */}

        <View style={styles.actions}>
          <Pressable
            style={
              styles.cancelButton
            }
            onPress={() =>
              router.replace(
                "/admin",
              )
            }
            disabled={
              saving ||
              uploading ||
              deletingMedia
            }
          >
            <Text
              style={
                styles.cancelText
              }
            >
              Cancel
            </Text>
          </Pressable>

          <Pressable
            style={
              styles.saveButton
            }
            onPress={
              saveSettings
            }
            disabled={
              saving ||
              uploading ||
              deletingMedia
            }
          >
            {saving ? (
              <ActivityIndicator
                color="#ffffff"
              />
            ) : (
              <Text
                style={
                  styles.saveText
                }
              >
                Save Storefront
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ==========================================================
// SECTION
// ==========================================================

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text
        style={
          styles.sectionTitle
        }
      >
        {title}
      </Text>

      <View style={styles.card}>
        {children}
      </View>
    </View>
  );
}

// ==========================================================
// FIELD
// ==========================================================

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = "default",
  autoCapitalize = "sentences",
}: {
  label: string;
  value: string;
  onChangeText: (
    value: string,
  ) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?:
    | "default"
    | "decimal-pad"
    | "number-pad"
    | "phone-pad";
  autoCapitalize?:
    | "none"
    | "sentences";
}) {
  return (
    <View style={styles.field}>
      <Text
        style={
          styles.label
        }
      >
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={
          onChangeText
        }
        placeholder={
          placeholder
        }
        placeholderTextColor="#aaa49a"
        multiline={
          multiline
        }
        keyboardType={
          keyboardType
        }
        autoCapitalize={
          autoCapitalize
        }
        style={[
          styles.input,
          multiline &&
            styles.textarea,
        ]}
      />
    </View>
  );
}

// ==========================================================
// SWITCH
// ==========================================================

function DisplaySwitch({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (
    value: boolean,
  ) => void;
}) {
  return (
    <View
      style={
        styles.switchRow
      }
    >
      <View
        style={
          styles.switchText
        }
      >
        <Text
          style={
            styles.switchLabel
          }
        >
          {label}
        </Text>

        <Text
          style={
            styles.switchDescription
          }
        >
          {description}
        </Text>
      </View>

      <Switch
        value={value}
        onValueChange={
          onValueChange
        }
        trackColor={{
          false: "#d5d1ca",
          true:
            STORE.colors
              .primary,
        }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

// ==========================================================
// CHECKBOX
// ==========================================================

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (
    value: boolean,
  ) => void;
}) {
  return (
    <Pressable
      style={
        styles.checkboxRow
      }
      onPress={() =>
        onChange(!checked)
      }
    >
      <View
        style={[
          styles.checkbox,
          checked &&
            styles.checkboxChecked,
        ]}
      >
        {checked ? (
          <Text
            style={
              styles.checkmark
            }
          >
            ✓
          </Text>
        ) : null}
      </View>

      <Text
        style={
          styles.checkboxLabel
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ==========================================================
// STYLES
// ==========================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor:
      STORE.colors.background,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 60,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color:
      STORE.colors.mutedText,
  },

  header: {
    marginBottom: 24,
  },

  backButton: {
    alignSelf:
      "flex-start",
    marginBottom: 16,
  },

  backText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#806638",
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#292824",
  },

  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: "#716d66",
  },

  section: {
    marginBottom: 18,
  },

  sectionTitle: {
    marginBottom: 10,
    fontSize: 18,
    fontWeight: "700",
    color: "#292824",
  },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d8d5cf",
    backgroundColor: "#fffdf9",
    padding: 16,
  },

  sectionDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: "#777169",
    marginBottom: 14,
  },

  field: {
    marginBottom: 15,
  },

  label: {
    marginBottom: 7,
    fontSize: 13,
    fontWeight: "700",
    color: "#403d38",
  },

  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#d8d5cf",
    borderRadius: 11,
    backgroundColor: "#ffffff",
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 14,
    color: "#292824",
  },

  textarea: {
    minHeight: 110,
    textAlignVertical:
      "top",
  },

  helper: {
    marginTop: -6,
    marginBottom: 12,
    fontSize: 11,
    lineHeight: 17,
    color: "#888177",
  },

  optionGroup: {
    gap: 8,
  },

  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    borderWidth: 1,
    borderColor: "#d8d5cf",
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },

  optionCardSelected: {
    borderColor:
      STORE.colors.primary,
    backgroundColor:
      "#f8f0df",
  },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#bbb5aa",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  radioSelected: {
    borderColor:
      STORE.colors.primary,
  },

  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor:
      STORE.colors.primary,
  },

  optionText: {
    flex: 1,
  },

  optionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#403d38",
  },

  optionDescription: {
    marginTop: 2,
    fontSize: 11,
    color: "#777169",
  },

  mediaList: {
    gap: 10,
    marginBottom: 12,
  },

  mediaCard: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#d8d5cf",
    backgroundColor: "#ffffff",
  },

  heroImage: {
    width: "100%",
    height: 190,
  },

  videoPlaceholder: {
    width: "100%",
    height: 190,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eee7da",
  },

  videoIcon: {
    fontSize: 34,
    color: "#6d5630",
  },

  videoText: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: "700",
    color: "#6d5630",
  },

  mediaFooter: {
    minHeight: 42,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
  },

  mediaType: {
    fontSize: 11,
    fontWeight: "600",
    color: "#777169",
    textTransform:
      "uppercase",
  },

  smallRemoveButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  smallRemoveText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#b42318",
  },

  videoPlaceholderText: {
    color: "#777169",
  },

  emptyBox: {
    minHeight: 70,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#cfc8ba",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#faf8f3",
    marginBottom: 12,
  },

  emptyText: {
    fontSize: 12,
    color: "#888177",
  },

  secondaryButton: {
    minHeight: 44,
    paddingHorizontal: 15,
    borderRadius: 11,
    backgroundColor: "#eee7da",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },

  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6d5630",
  },

  outlineButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#d1cdc5",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },

  outlineButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#514d47",
  },

  orderList: {
    gap: 8,
  },

  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 54,
    padding: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8d5cf",
    backgroundColor: "#ffffff",
  },

  orderNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#eee7da",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  orderNumberText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6d5630",
  },

  orderLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#403d38",
  },

  orderButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  arrowButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1cdc5",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },

  arrowText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#514d47",
  },

  disabledButton: {
    opacity: 0.35,
  },

  removeTextButton: {
    paddingHorizontal: 5,
    paddingVertical: 8,
  },

  removeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#b42318",
  },

  checkboxList: {
    gap: 8,
  },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#d8d5cf",
    backgroundColor: "#ffffff",
  },

  checkbox: {
    width: 21,
    height: 21,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#aaa49a",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  checkboxChecked: {
    backgroundColor:
      STORE.colors.primary,
    borderColor:
      STORE.colors.primary,
  },

  checkmark: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },

  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#403d38",
  },

  switchRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    gap: 12,
  },

  switchText: {
    flex: 1,
  },

  switchLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#403d38",
  },

  switchDescription: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: "#777169",
  },

  innerSpacing: {
    marginTop: 12,
  },

  socialCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d8d5cf",
    backgroundColor: "#ffffff",
    marginBottom: 10,
  },

  socialHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    marginBottom: 14,
  },

  socialTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#403d38",
  },

  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  socialIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: "#d8d5cf",
  },

  noIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: "#d8d5cf",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#faf8f3",
  },

  noIconText: {
    fontSize: 9,
    color: "#888177",
  },

  divider: {
    height: 1,
    backgroundColor: "#e3dfd7",
    marginVertical: 12,
  },

  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },

  cancelButton: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#d1cdc5",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },

  cancelText: {
    color: "#514d47",
    fontSize: 14,
    fontWeight: "700",
  },

  saveButton: {
    flex: 1.5,
    minHeight: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#292824",
  },

  saveText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
});