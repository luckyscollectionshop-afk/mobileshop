
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import { supabase } from "@/lib/supabase";
import { STORE } from "@/constants/store";

/* =========================================================
   TYPES
   ========================================================= */

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
};

type CartProduct = {
  id: string;
  name: string;
  price: number;
  sale_price: number | null;
  stock: number;
  images: string[];
  available_for_sale: boolean;
  weight_grams: number | null;
  size: string | null;
  height: number | null;
  width: number | null;
  depth: number | null;
};

type CartItem = {
  id: string;
  quantity: number;
  product: CartProduct;
};

type StorefrontSettings = {
  twint_enabled: boolean;
  twint_phone: string | null;

  bank_transfer_enabled: boolean;
  bank_account_name: string | null;
  bank_iban: string | null;

  shipping_enabled: boolean;
  shipping_method: string | null;
  shipping_price: number;
  free_shipping: boolean;
};

type PaymentMethod = "twint" | "bank_transfer" | null;

/* =========================================================
   COMPONENT
   ========================================================= */

export default function CheckoutScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [items, setItems] = useState<CartItem[]>([]);

  const [settings, setSettings] =
    useState<StorefrontSettings | null>(null);

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>(null);

  /* =========================================================
     Editable checkout address fields

     These come from profiles.
     ========================================================= */

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Switzerland");

  /* =========================================================
     LOAD CHECKOUT
     ========================================================= */

  useFocusEffect(
    useCallback(() => {
      loadCheckout();
    }, []),
  );

  async function loadCheckout() {
    try {
      setLoading(true);

      console.log("🟢 CHECKOUT loadCheckout() STARTED");

      /* -----------------------------------------------------
         Current user
         ----------------------------------------------------- */

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      console.log(
        "👤 CHECKOUT USER:",
        user?.id,
        user?.email,
      );

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      /* -----------------------------------------------------
         Load profile, cart and storefront settings
         ----------------------------------------------------- */

      const [
        profileResult,
        cartResult,
        settingsResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            `
              id,
              full_name,
              phone,
              address,
              city,
              postal_code,
              country
            `,
          )
          .eq("id", user.id)
          .maybeSingle(),

        supabase
          .from("carts")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle(),

        supabase
          .from("storefront_settings")
          .select(
            `
              twint_enabled,
              twint_phone,
              bank_transfer_enabled,
              bank_account_name,
              bank_iban,
              shipping_enabled,
              shipping_method,
              shipping_price,
              free_shipping
            `,
          )
          .limit(1)
          .maybeSingle(),
      ]);

      /* -----------------------------------------------------
         Profile
         ----------------------------------------------------- */

      if (profileResult.error) {
        console.error(
          "❌ PROFILE QUERY ERROR:",
          profileResult.error,
        );

        throw profileResult.error;
      }

      const loadedProfile =
        profileResult.data as Profile | null;

      console.log(
        "✅ CHECKOUT PROFILE:",
        loadedProfile,
      );

      setProfile(loadedProfile);

      /* -----------------------------------------------------
         Populate editable checkout fields from profile
         ----------------------------------------------------- */

      setFullName(
        loadedProfile?.full_name ?? "",
      );

      setPhone(
        loadedProfile?.phone ?? "",
      );

      setAddress(
        loadedProfile?.address ?? "",
      );

      setPostalCode(
        loadedProfile?.postal_code ?? "",
      );

      setCity(
        loadedProfile?.city ?? "",
      );

      setCountry(
        loadedProfile?.country ||
          "Switzerland",
      );

      /* -----------------------------------------------------
         Storefront settings
         ----------------------------------------------------- */

      if (settingsResult.error) {
        throw settingsResult.error;
      }

      if (settingsResult.data) {
        setSettings({
          ...settingsResult.data,
          shipping_price: Number(
            settingsResult.data
              .shipping_price ?? 0,
          ),
        } as StorefrontSettings);

        /* ---------------------------------------------------
           Automatically select first available payment
           --------------------------------------------------- */

        if (
          settingsResult.data
            .twint_enabled
        ) {
          setPaymentMethod("twint");
        } else if (
          settingsResult.data
            .bank_transfer_enabled
        ) {
          setPaymentMethod(
            "bank_transfer",
          );
        } else {
          setPaymentMethod(null);
        }
      } else {
        setSettings(null);
        setPaymentMethod(null);
      }

      /* -----------------------------------------------------
         Cart
         ----------------------------------------------------- */

      if (cartResult.error) {
        throw cartResult.error;
      }

      if (!cartResult.data) {
        console.log(
          "🛒 CHECKOUT: No cart found",
        );

        setItems([]);
        return;
      }

      const {
        data: cartItems,
        error: cartItemsError,
      } = await supabase
        .from("cart_items")
        .select(
          `
            id,
            quantity,
            product_id,
            products (
              id,
              name,
              price,
              sale_price,
              stock,
              images,
              available_for_sale,
              weight_grams,
              size,
              height,
              width,
              depth
            )
          `,
        )
        .eq("cart_id", cartResult.data.id)
        .order("created_at", {
          ascending: true,
        });

      if (cartItemsError) {
        throw cartItemsError;
      }

      const formattedItems: CartItem[] =
        (cartItems ?? []).flatMap(
          (item) => {
            const product = item.products as
              | CartProduct
              | CartProduct[]
              | null;

            const actualProduct =
              Array.isArray(product)
                ? product[0]
                : product;

            if (!actualProduct) {
              return [];
            }

            return [
              {
                id: item.id,
                quantity: item.quantity,
                product: {
                  ...actualProduct,

                  price: Number(
                    actualProduct.price,
                  ),

                  sale_price:
                    actualProduct.sale_price ==
                    null
                      ? null
                      : Number(
                          actualProduct.sale_price,
                        ),

                  stock:
                    actualProduct.stock ?? 0,

                  images:
                    Array.isArray(
                      actualProduct.images,
                    )
                      ? actualProduct.images
                      : [],

                  weight_grams:
                    actualProduct.weight_grams ==
                    null
                      ? null
                      : Number(
                          actualProduct.weight_grams,
                        ),

                  height:
                    actualProduct.height ==
                    null
                      ? null
                      : Number(
                          actualProduct.height,
                        ),

                  width:
                    actualProduct.width ==
                    null
                      ? null
                      : Number(
                          actualProduct.width,
                        ),

                  depth:
                    actualProduct.depth ==
                    null
                      ? null
                      : Number(
                          actualProduct.depth,
                        ),
                },
              },
            ];
          },
        );

      console.log(
        "✅ CHECKOUT CART ITEMS:",
        formattedItems.length,
      );

      setItems(formattedItems);
    } catch (error) {
      console.error(
        "❌ Checkout loading error:",
        error,
      );

      Alert.alert(
        "Unable to load checkout",
        "Please try again.",
      );
    } finally {
      setLoading(false);

      console.log(
        "🔵 CHECKOUT loadCheckout() FINISHED",
      );
    }
  }

  /* =========================================================
     SAVE PROFILE ADDRESS

     When the user edits their address at checkout,
     save it back to profiles so the web app and mobile
     app continue using the same current address.
     ========================================================= */

  async function saveCheckoutAddress() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return false;
      }

      const trimmedFullName =
        fullName.trim();

      const trimmedPhone =
        phone.trim();

      const trimmedAddress =
        address.trim();

      const trimmedPostalCode =
        postalCode.trim();

      const trimmedCity =
        city.trim();

      const trimmedCountry =
        country.trim();

      if (
        !trimmedFullName ||
        !trimmedPhone ||
        !trimmedAddress ||
        !trimmedPostalCode ||
        !trimmedCity ||
        !trimmedCountry
      ) {
        Alert.alert(
          "Missing information",
          "Please complete all shipping address fields.",
        );

        return false;
      }

      console.log(
        "💾 Saving checkout address to profile...",
      );

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name:
            trimmedFullName,
          phone: trimmedPhone,
          address: trimmedAddress,
          postal_code:
            trimmedPostalCode,
          city: trimmedCity,
          country:
            trimmedCountry,
        })
        .eq("id", user.id);

      if (error) {
        console.error(
          "❌ PROFILE UPDATE ERROR:",
          error,
        );

        throw error;
      }

      console.log(
        "✅ CHECKOUT PROFILE ADDRESS SAVED",
      );

      setProfile((current) => ({
        ...(current ?? {
          id: user.id,
          full_name: null,
          phone: null,
          address: null,
          city: null,
          postal_code: null,
          country: null,
        }),

        full_name:
          trimmedFullName,
        phone: trimmedPhone,
        address: trimmedAddress,
        postal_code:
          trimmedPostalCode,
        city: trimmedCity,
        country:
          trimmedCountry,
      }));

      return true;
    } catch (error) {
      console.error(
        "❌ Saving checkout address failed:",
        error,
      );

      Alert.alert(
        "Unable to save address",
        "Please try again.",
      );

      return false;
    }
  }
  /* =========================================================
     PLACE ORDER

     The Android app sends the authenticated Supabase
     access token to the deployed web API.

     The server remains responsible for:
     - product validation
     - stock validation
     - pre-booking rules
     - price calculation
     - shipping calculation
     - order creation
     - order items
     - cart clearing
     - notifications
     ========================================================= */

  async function placeOrder() {
    if (placingOrder) {
      return;
    }

    try {
      setPlacingOrder(true);

      console.log("🟢 MOBILE PLACE ORDER STARTED");

      /* -----------------------------------------------------
         Current authenticated user/session
         ----------------------------------------------------- */

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session?.access_token) {
        Alert.alert(
          "Please sign in",
          "Your login session has expired. Please sign in again.",
        );

        router.replace("/auth/login");
        return;
      }

      console.log(
        "✅ MOBILE ORDER SESSION FOUND",
        session.user.id,
      );

      /* -----------------------------------------------------
         Validate address
         ----------------------------------------------------- */

      const trimmedFullName = fullName.trim();
      const trimmedPhone = phone.trim();
      const trimmedAddress = address.trim();
      const trimmedPostalCode = postalCode.trim();
      const trimmedCity = city.trim();
      const trimmedCountry = country.trim();

      if (
        !trimmedFullName ||
        !trimmedPhone ||
        !trimmedAddress ||
        !trimmedPostalCode ||
        !trimmedCity ||
        !trimmedCountry
      ) {
        Alert.alert(
          "Missing information",
          "Please complete all shipping address fields.",
        );

        return;
      }

      /* -----------------------------------------------------
         Validate payment method
         ----------------------------------------------------- */

      if (
        paymentMethod !== "twint" &&
        paymentMethod !== "bank_transfer"
      ) {
        Alert.alert(
          "Payment method required",
          "Please select a payment method.",
        );

        return;
      }

      /* -----------------------------------------------------
         Save address first

         The web shop also keeps the latest checkout address
         in the user's profile.
         ----------------------------------------------------- */

      const saved = await saveCheckoutAddress();

      if (!saved) {
        return;
      }

      /* -----------------------------------------------------
         API URL
         ----------------------------------------------------- */

      const apiBaseUrl =
        process.env.EXPO_PUBLIC_WEB_API_URL?.replace(
          /\/$/,
          "",
        );

      if (!apiBaseUrl) {
        throw new Error(
          "Web API URL is not configured.",
        );
      }

      console.log(
        "🌐 MOBILE ORDER API:",
        `${apiBaseUrl}/api/orders`,
      );

      /* -----------------------------------------------------
         Create order through the deployed web API
         ----------------------------------------------------- */

      const response = await fetch(
        `${apiBaseUrl}/api/orders`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            full_name: trimmedFullName,
            phone: trimmedPhone,
            address: trimmedAddress,
            city: trimmedCity,
            postal_code: trimmedPostalCode,
            country: trimmedCountry,
            payment_method: paymentMethod,
          }),
        },
      );

      /* -----------------------------------------------------
         Read API response

         We read text first so that an unexpected HTML/server
         response does not cause JSON.parse() to hide the
         actual problem.
         ----------------------------------------------------- */

      const responseText = await response.text();

      console.log(
        "📦 MOBILE ORDER API STATUS:",
        response.status,
      );

      console.log(
        "📦 MOBILE ORDER API RESPONSE:",
        responseText,
      );

      let result: {
        success?: boolean;
        order_id?: string;
        order_number?: string;
        error?: string;
      } = {};

      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(
          `The order server returned an unexpected response (${response.status}).`,
        );
      }

      /* -----------------------------------------------------
         API error
         ----------------------------------------------------- */

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to place your order.",
        );
      }

      /* -----------------------------------------------------
         Verify successful response
         ----------------------------------------------------- */

      if (
        !result.success ||
        !result.order_id ||
        !result.order_number
      ) {
        throw new Error(
          "The order was not created successfully.",
        );
      }

      console.log(
        "🎉 MOBILE ORDER CREATED:",
        result.order_number,
      );

      /* -----------------------------------------------------
         Go to mobile Order Success

         We pass the order number exactly like the web shop
         does with ?order=...
         ----------------------------------------------------- */

      router.replace({
  pathname: "/order-success",
  params: {
    order: result.order_number,
  },
});
    } catch (error) {
      console.error(
        "❌ MOBILE PLACE ORDER ERROR:",
        error,
      );

      Alert.alert(
        "Unable to place order",
        error instanceof Error
          ? error.message
          : "Something went wrong while placing your order. Please try again.",
      );
    } finally {
      setPlacingOrder(false);

      console.log(
        "🔵 MOBILE PLACE ORDER FINISHED",
      );
    }
  }
  /* =========================================================
     EMPTY CART
     ========================================================= */

  if (!loading && items.length === 0) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <View
          style={styles.emptyContainer}
        >
          <Text
            style={styles.emptyIcon}
          >
            🛒
          </Text>

          <Text
            style={styles.emptyTitle}
          >
            Your cart is empty
          </Text>

          <Text
            style={styles.emptyText}
          >
            Add products to your cart
            before checking out.
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() =>
              router.replace(
                "/explore",
              )
            }
          >
            <Text
              style={
                styles.primaryButtonText
              }
            >
              Continue shopping
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <SafeAreaView
        style={styles.center}
      >
        <ActivityIndicator
          size="large"
        />

        <Text
          style={styles.loadingText}
        >
          Loading checkout...
        </Text>
      </SafeAreaView>
    );
  }

  /* =========================================================
     TOTALS
     ========================================================= */

  const subtotal = items.reduce(
    (total, item) => {
      const price =
        item.product.sale_price !==
        null
          ? item.product.sale_price
          : item.product.price;

      return (
        total +
        price * item.quantity
      );
    },
    0,
  );

  const shippingCost =
    settings?.shipping_enabled &&
    !settings.free_shipping
      ? Number(
          settings.shipping_price ?? 0,
        )
      : 0;

  const total =
    subtotal + shippingCost;

  const hasPaymentMethod =
    !!(
      settings?.twint_enabled ||
      settings?.bank_transfer_enabled
    );

  const addressComplete =
    fullName.trim().length > 0 &&
    phone.trim().length > 0 &&
    address.trim().length > 0 &&
    postalCode.trim().length > 0 &&
    city.trim().length > 0 &&
    country.trim().length > 0;

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.container
        }
      >
        {/* ===================================================
            PAGE TITLE
           =================================================== */}

        <View
          style={styles.headerRow}
        >
          <Pressable
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={styles.backText}
            >
              ← Back
            </Text>
          </Pressable>

          <Text style={styles.title}>
            Checkout
          </Text>

          <View
            style={styles.headerSpacer}
          />
        </View>

        {/* ===================================================
            SHIPPING ADDRESS
           =================================================== */}

        <View style={styles.section}>
          <Text
            style={styles.sectionTitle}
          >
            1. Shipping address
          </Text>

          <View
            style={styles.addressCard}
          >
            <Text
              style={styles.addressHint}
            >
              Your current delivery
              details are shown below.
              You can edit them if
              needed.
            </Text>

            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Full name"
              placeholderTextColor="#999"
              style={styles.input}
            />

            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              style={styles.input}
            />

            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Address"
              placeholderTextColor="#999"
              style={styles.input}
            />

            <View
              style={styles.inputRow}
            >
              <TextInput
                value={postalCode}
                onChangeText={
                  setPostalCode
                }
                placeholder="Postal code"
                placeholderTextColor="#999"
                keyboardType="number-pad"
                style={[
                  styles.input,
                  styles.postalInput,
                ]}
              />

              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="City"
                placeholderTextColor="#999"
                style={[
                  styles.input,
                  styles.cityInput,
                ]}
              />
            </View>

            <TextInput
              value={country}
              onChangeText={setCountry}
              placeholder="Country"
              placeholderTextColor="#999"
              style={styles.input}
            />

            <Text
              style={styles.profileNote}
            >
              Changes made here will
              update your saved account
              details.
            </Text>
          </View>
        </View>

        {/* ===================================================
            PAYMENT
           =================================================== */}

        <View style={styles.section}>
          <Text
            style={styles.sectionTitle}
          >
            2. Payment method
          </Text>

          {!hasPaymentMethod ? (
            <View
              style={styles.warningBox}
            >
              <Text
                style={styles.warningText}
              >
                No payment method is
                currently available.
              </Text>
            </View>
          ) : (
            <View
              style={styles.paymentList}
            >
              {settings?.twint_enabled && (
                <Pressable
                  onPress={() =>
                    setPaymentMethod(
                      "twint",
                    )
                  }
                  style={[
                    styles.paymentCard,
                    paymentMethod ===
                      "twint" &&
                      styles.paymentCardSelected,
                  ]}
                >
                  <View
                    style={
                      styles.paymentRadio
                    }
                  >
                    {paymentMethod ===
                      "twint" && (
                      <View
                        style={
                          styles.paymentDot
                        }
                      />
                    )}
                  </View>

                  <View
                    style={
                      styles.paymentContent
                    }
                  >
                    <Text
                      style={
                        styles.paymentTitle
                      }
                    >
                      TWINT
                    </Text>

                    <Text
                      style={
                        styles.paymentDescription
                      }
                    >
                      Pay using TWINT
                    </Text>

                    {settings.twint_phone && (
                      <Text
                        style={
                          styles.paymentInfo
                        }
                      >
                        {
                          settings.twint_phone
                        }
                      </Text>
                    )}
                  </View>
                </Pressable>
              )}

              {settings?.bank_transfer_enabled && (
                <Pressable
                  onPress={() =>
                    setPaymentMethod(
                      "bank_transfer",
                    )
                  }
                  style={[
                    styles.paymentCard,
                    paymentMethod ===
                      "bank_transfer" &&
                      styles.paymentCardSelected,
                  ]}
                >
                  <View
                    style={
                      styles.paymentRadio
                    }
                  >
                    {paymentMethod ===
                      "bank_transfer" && (
                      <View
                        style={
                          styles.paymentDot
                        }
                      />
                    )}
                  </View>

                  <View
                    style={
                      styles.paymentContent
                    }
                  >
                    <Text
                      style={
                        styles.paymentTitle
                      }
                    >
                      Bank transfer
                    </Text>

                    <Text
                      style={
                        styles.paymentDescription
                      }
                    >
                      Pay by bank transfer
                    </Text>

                    {settings.bank_account_name && (
                      <Text
                        style={
                          styles.paymentInfo
                        }
                      >
                        {
                          settings.bank_account_name
                        }
                      </Text>
                    )}

                    {settings.bank_iban && (
                      <Text
                        style={
                          styles.paymentInfo
                        }
                      >
                        {settings.bank_iban}
                      </Text>
                    )}
                  </View>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* ===================================================
            SHIPPING
           =================================================== */}

        <View style={styles.section}>
          <Text
            style={styles.sectionTitle}
          >
            3. Shipping
          </Text>

          {!settings?.shipping_enabled ? (
            <View
              style={styles.infoBox}
            >
              <Text
                style={styles.infoText}
              >
                Shipping is not enabled.
              </Text>
            </View>
          ) : settings.free_shipping ? (
            <View
              style={styles.shippingCard}
            >
              <View>
                <Text
                  style={
                    styles.shippingTitle
                  }
                >
                  {settings.shipping_method ||
                    "Shipping"}
                </Text>

                <Text
                  style={
                    styles.shippingDescription
                  }
                >
                  Free shipping
                </Text>
              </View>

              <Text
                style={
                  styles.shippingPrice
                }
              >
                FREE
              </Text>
            </View>
          ) : (
            <View
              style={styles.shippingCard}
            >
              <View>
                <Text
                  style={
                    styles.shippingTitle
                  }
                >
                  {settings.shipping_method ||
                    "Shipping"}
                </Text>

                <Text
                  style={
                    styles.shippingDescription
                  }
                >
                  Shipping fee
                </Text>
              </View>

              <Text
                style={
                  styles.shippingPrice
                }
              >
                CHF{" "}
                {shippingCost.toFixed(
                  2,
                )}
              </Text>
            </View>
          )}
        </View>

        {/* ===================================================
            ORDER SUMMARY
           =================================================== */}

        <View style={styles.section}>
          <Text
            style={styles.sectionTitle}
          >
            4. Order summary
          </Text>

          <View
            style={styles.summaryCard}
          >
            {items.map((item) => {
              const price =
                item.product.sale_price !==
                null
                  ? item.product
                      .sale_price
                  : item.product.price;

              const lineTotal =
                price *
                item.quantity;

              const image =
                item.product.images?.[0] ??
                null;

              return (
                <View
                  key={item.id}
                  style={
                    styles.summaryItem
                  }
                >
                  <View
                    style={
                      styles.summaryImageContainer
                    }
                  >
                    {image ? (
                      <Image
                        source={{
                          uri: image,
                        }}
                        style={
                          styles.summaryImage
                        }
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={
                          styles.noImage
                        }
                      >
                        <Text
                          style={
                            styles.noImageText
                          }
                        >
                          —
                        </Text>
                      </View>
                    )}
                  </View>

                  <View
                    style={
                      styles.summaryItemInfo
                    }
                  >
                    <Text
                      style={
                        styles.summaryItemName
                      }
                      numberOfLines={2}
                    >
                      {
                        item.product.name
                      }
                    </Text>

                    <Text
                      style={
                        styles.summaryItemQuantity
                      }
                    >
                      Qty:{" "}
                      {item.quantity}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.summaryItemPrice
                    }
                  >
                    CHF{" "}
                    {lineTotal.toFixed(
                      2,
                    )}
                  </Text>
                </View>
              );
            })}

            <View
              style={styles.divider}
            />

            <View
              style={styles.totalRow}
            >
              <Text
                style={styles.totalLabel}
              >
                Subtotal
              </Text>

              <Text
                style={styles.totalValue}
              >
                CHF{" "}
                {subtotal.toFixed(2)}
              </Text>
            </View>

            <View
              style={styles.totalRow}
            >
              <Text
                style={styles.totalLabel}
              >
                Shipping
              </Text>

              <Text
                style={styles.totalValue}
              >
                {shippingCost === 0
                  ? "FREE"
                  : `CHF ${shippingCost.toFixed(
                      2,
                    )}`}
              </Text>
            </View>

            <View
              style={styles.divider}
            />

            <View
              style={
                styles.grandTotalRow
              }
            >
              <Text
                style={
                  styles.grandTotalLabel
                }
              >
                Total
              </Text>

              <Text
                style={
                  styles.grandTotalValue
                }
              >
                CHF{" "}
                {total.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* ===================================================
            PLACE ORDER
           =================================================== */}

       <Pressable
  style={[
    styles.placeOrderButton,
    (!hasPaymentMethod ||
      !addressComplete ||
      placingOrder) &&
      styles.placeOrderDisabled,
  ]}
  disabled={
    !hasPaymentMethod ||
    !addressComplete ||
    placingOrder
  }
  onPress={placeOrder}
>
  {placingOrder ? (
    <View style={styles.placeOrderLoading}>
      <ActivityIndicator
        size="small"
        color="#fff"
      />
      <Text style={styles.placeOrderText}>
        Placing order...
      </Text>
    </View>
  ) : (
    <Text style={styles.placeOrderText}>
      Place order
    </Text>
  )}
</Pressable>

        {!addressComplete && (
          <Text
            style={styles.addressRequiredNote}
          >
            Please complete your
            shipping address before
            placing the order.
          </Text>
        )}

        <Text
          style={styles.secureNote}
        >
          Your order will be securely
          processed through your selected
          payment method.
        </Text>
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
    backgroundColor:
      STORE.colors.background,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor:
      STORE.colors.background,
  },

  loadingText: {
    marginTop: 10,
    color: "#777",
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 50,
  },

  /* =======================================================
     Header
     ======================================================= */

  headerRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  backText: {
    fontSize: 14,
    color: "#555",
    fontWeight: "500",
  },

  title: {
    fontSize: 25,
    fontWeight: "700",
    color: "#222",
  },

  headerSpacer: {
    width: 45,
  },

  /* =======================================================
     Sections
     ======================================================= */

  section: {
    marginTop: 20,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222",
    marginBottom: 12,
  },

  /* =======================================================
     Address
     ======================================================= */

  addressCard: {
    borderWidth: 1,
    borderColor: "#ddd8cf",
    borderRadius: 14,
    padding: 14,
    backgroundColor:
      "rgba(255,255,255,0.45)",
  },

  addressHint: {
    fontSize: 12,
    lineHeight: 18,
    color: "#777",
    marginBottom: 12,
  },

  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#d8d4cc",
    borderRadius: 10,
    paddingHorizontal: 13,
    fontSize: 14,
    color: "#222",
    backgroundColor:
      "rgba(255,255,255,0.65)",
    marginBottom: 10,
  },

  inputRow: {
    flexDirection: "row",
    gap: 10,
  },

  postalInput: {
    flex: 0.38,
  },

  cityInput: {
    flex: 0.62,
  },

  profileNote: {
    marginTop: 1,
    fontSize: 11,
    lineHeight: 16,
    color: "#888",
  },

  /* =======================================================
     Payment
     ======================================================= */

  paymentList: {
    gap: 10,
  },

  paymentCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#ddd8cf",
    borderRadius: 14,
    padding: 14,
    backgroundColor:
      "rgba(255,255,255,0.45)",
  },

  paymentCardSelected: {
    borderColor: "#bd9650",
    backgroundColor:
      "rgba(255,255,255,0.7)",
  },

  paymentRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#aaa",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 1,
  },

  paymentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#bd9650",
  },

  paymentContent: {
    flex: 1,
  },

  paymentTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#222",
  },

  paymentDescription: {
    marginTop: 3,
    fontSize: 12,
    color: "#777",
  },

  paymentInfo: {
    marginTop: 5,
    fontSize: 12,
    color: "#555",
  },

  /* =======================================================
     Shipping
     ======================================================= */

  shippingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ddd8cf",
    borderRadius: 14,
    padding: 14,
    backgroundColor:
      "rgba(255,255,255,0.45)",
  },

  shippingTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#222",
  },

  shippingDescription: {
    marginTop: 3,
    fontSize: 12,
    color: "#777",
  },

  shippingPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#222",
  },

  /* =======================================================
     Summary
     ======================================================= */

  summaryCard: {
    borderWidth: 1,
    borderColor: "#ddd8cf",
    borderRadius: 14,
    padding: 14,
    backgroundColor:
      "rgba(255,255,255,0.45)",
  },

  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 13,
  },

  summaryImageContainer: {
    width: 58,
    height: 58,
    borderRadius: 9,
    overflow: "hidden",
    backgroundColor: "#eee",
  },

  summaryImage: {
    width: "100%",
    height: "100%",
  },

  noImage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  noImageText: {
    color: "#999",
  },

  summaryItemInfo: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
  },

  summaryItemName: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: "#222",
  },

  summaryItemQuantity: {
    marginTop: 3,
    fontSize: 11,
    color: "#777",
  },

  summaryItemPrice: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: "600",
    color: "#222",
  },

  divider: {
    height: 1,
    backgroundColor: "#e4e0d9",
    marginVertical: 8,
  },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
  },

  totalLabel: {
    fontSize: 13,
    color: "#666",
  },

  totalValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },

  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 6,
  },

  grandTotalLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: "#222",
  },

  grandTotalValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#222",
  },

  /* =======================================================
     Messages
     ======================================================= */

  warningBox: {
    borderWidth: 1,
    borderColor: "#e3c7c4",
    borderRadius: 12,
    padding: 13,
    backgroundColor: "#fff6f5",
  },

  warningText: {
    fontSize: 13,
    color: "#9b3028",
  },

  infoBox: {
    borderWidth: 1,
    borderColor: "#ddd8cf",
    borderRadius: 12,
    padding: 13,
    backgroundColor:
      "rgba(255,255,255,0.45)",
  },

  infoText: {
    fontSize: 13,
    color: "#777",
  },

  /* =======================================================
     Place order
     ======================================================= */

  placeOrderButton: {
    marginTop: 28,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "#111",
  },

  placeOrderDisabled: {
    backgroundColor: "#aaa",
  },

  placeOrderText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  addressRequiredNote: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 11,
    color: "#9b3028",
  },

  secureNote: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
    color: "#888",
  },
placeOrderLoading: {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
},
  /* =======================================================
     Empty
     ======================================================= */

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 35,
  },

  emptyIcon: {
    fontSize: 48,
    marginBottom: 14,
  },

  emptyTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#222",
  },

  emptyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    color: "#777",
  },

  primaryButton: {
    marginTop: 22,
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: "#111",
  },

  primaryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
