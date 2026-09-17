import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { VideoView, useVideoPlayer } from "expo-video";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { STORE } from "@/constants/store";

type HeroMedia = {
  url: string;
  type: "image" | "video";
};

type DisplaySettings = {
  price?: boolean;
  prebooking?: boolean;
};

type SiteSettings = {
  hero_title: string | null;
  hero_description: string | null;
  hero_image_url: string | null;
  hero_media: HeroMedia[] | null;
  homepage_category_ids: string[] | null;
};

type Product = {
  id: string;
  name: string;
  price: number;
  sale_price: number | null;
  images: string[] | null;
  display_settings: DisplaySettings | null;
  active: boolean;
  sticker: string | null;
};

type HomepageStrip = {
  id: string;
  name: string;
  slug: string | null;
  products: Product[];
  type: "category" | "all" | "prebooking";
};

const ALL_PRODUCTS_ID = "__all__";
const PREBOOKING_ID = "__prebooking__";

const SCREEN_WIDTH = Dimensions.get("window").width;
const HERO_WIDTH = SCREEN_WIDTH - 40;
const HERO_HEIGHT = 360;

/* =========================================================
   HERO VIDEO
   ========================================================= */

function HeroVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  return (
    <VideoView
      player={player}
      style={styles.heroMedia}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

/* =========================================================
   HOME
   ========================================================= */

export default function HomeScreen() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [homepageStrips, setHomepageStrips] = useState<HomepageStrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  const scrollViewRef = useRef<ScrollView>(null);

const arrowAnimation = useRef(new Animated.Value(0)).current;

useEffect(() => {
  const animation = Animated.loop(
    Animated.sequence([
      Animated.timing(arrowAnimation, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(arrowAnimation, {
        toValue: 0,
        duration: 900,
        useNativeDriver: true,
      }),
    ]),
  );

  animation.start();

  return () => {
    animation.stop();
  };
}, [arrowAnimation]);

const arrowOpacity = arrowAnimation.interpolate({
  inputRange: [0, 0.5, 1],
  outputRange: [0.45, 1, 0.45],
});

const arrowScale = arrowAnimation.interpolate({
  inputRange: [0, 0.5, 1],
  outputRange: [0.9, 1.15, 0.9],
});

  function scrollToCollection() {
    scrollViewRef.current?.scrollTo({
      y: 360,
      animated: true,
    });
  }

  useEffect(() => {
    loadHome();
  }, []);

  async function loadHome() {
    try {
      setLoading(true);
      setError(null);

      /* =====================================================
         1. Load homepage settings
         ===================================================== */

      const { data: siteSettings, error: settingsError } = await supabase
        .from("site_settings")
        .select(
          "hero_title, hero_description, hero_image_url, hero_media, homepage_category_ids",
        )
        .eq("id", true)
        .single();

      if (settingsError) {
        throw settingsError;
      }

      setSettings(siteSettings);

      const homepageStripIds =
        (siteSettings?.homepage_category_ids as string[] | null) ?? [];

      /* =====================================================
         2. Separate special strips from real categories
         ===================================================== */

      const categoryIds = homepageStripIds.filter(
        (id) => id !== ALL_PRODUCTS_ID && id !== PREBOOKING_ID,
      );

      /* =====================================================
         3. Load selected categories
         ===================================================== */

      const { data: categories, error: categoriesError } =
        categoryIds.length > 0
          ? await supabase
              .from("categories")
              .select("id, name, slug")
              .in("id", categoryIds)
              .eq("is_active", true)
          : { data: [], error: null };

      if (categoriesError) {
        throw categoriesError;
      }

      /* =====================================================
         4. Load active products
         
         We load all active products because they may be used
         by ALL PRODUCTS, PREBOOKING, or category strips.
         ===================================================== */

      const { data: allProductsData, error: allProductsError } =
        homepageStripIds.length > 0
          ? await supabase
              .from("products")
              .select(
                `
                  id,
                  name,
                  price,
                  sale_price,
                  images,
                  display_settings,
                  active,
                  sticker
                `,
              )
              .eq("active", true)
              .order("created_at", { ascending: false })
          : { data: [], error: null };

      if (allProductsError) {
        throw allProductsError;
      }

      const allProducts = (allProductsData ?? []) as Product[];

      /* =====================================================
         5. Sort ALL PRODUCTS by name
         ===================================================== */

      allProducts.sort((a, b) => a.name.localeCompare(b.name));

      /* =====================================================
         6. Load category → product relationships
         ===================================================== */

      const { data: categoryLinks, error: categoryProductsError } =
        categoryIds.length > 0
          ? await supabase
              .from("product_categories")
              .select(
                `
                  category_id,
                  product:products(
                    id,
                    name,
                    price,
                    sale_price,
                    images,
                    display_settings,
                    active,
                    sticker
                  )
                `,
              )
              .in("category_id", categoryIds)
          : { data: [], error: null };

      if (categoryProductsError) {
        throw categoryProductsError;
      }

      /* =====================================================
         7. Build products by category
         ===================================================== */

      const productsByCategory = new Map<string, Product[]>();

      for (const link of categoryLinks ?? []) {
        const product = link.product as Product | Product[] | null;

        if (!product) continue;

        const item = Array.isArray(product) ? product[0] : product;

        if (!item || !item.active) continue;

        const existing = productsByCategory.get(link.category_id) ?? [];

        if (!existing.some((p) => p.id === item.id)) {
          existing.push(item);
        }

        productsByCategory.set(link.category_id, existing);
      }

      /* =====================================================
         8. Sort category products by name
         ===================================================== */

      for (const products of productsByCategory.values()) {
        products.sort((a, b) => a.name.localeCompare(b.name));
      }

      /* =====================================================
         9. Build homepage strips in EXACT admin order
         ===================================================== */

      const strips: HomepageStrip[] = [];

      for (const stripId of homepageStripIds) {
        /* ===================================================
           ALL PRODUCTS
           =================================================== */

        if (stripId === ALL_PRODUCTS_ID) {
          strips.push({
            id: ALL_PRODUCTS_ID,
            name: "All Products",
            slug: null,
            products: allProducts,
            type: "all",
          });

          continue;
        }

        /* ===================================================
           PREBOOKING
           =================================================== */

        if (stripId === PREBOOKING_ID) {
          const prebookingProducts = allProducts.filter(
            (product) => product.display_settings?.prebooking === true,
          );

          strips.push({
            id: PREBOOKING_ID,
            name: "Prebooking",
            slug: null,
            products: prebookingProducts,
            type: "prebooking",
          });

          continue;
        }

        /* ===================================================
           NORMAL CATEGORY
           =================================================== */

        const category = (categories ?? []).find((item) => item.id === stripId);

        if (!category) continue;

        strips.push({
          id: category.id,
          name: category.name,
          slug: category.slug,
          products: productsByCategory.get(category.id) ?? [],
          type: "category",
        });
      }

      setHomepageStrips(strips);
    } catch (err) {
      console.error("Home loading error:", err);
      setError("Unable to load the shop.");
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>Loading {STORE.name}</Text>
      </SafeAreaView>
    );
  }

  /* =========================================================
     ERROR
     ========================================================= */

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  /* =========================================================
     HERO MEDIA
     ========================================================= */

  let heroMedia: HeroMedia[] = Array.isArray(settings?.hero_media)
    ? settings.hero_media
    : [];

  /*
   * Fallback:
   * If hero_media is empty but the old hero_image_url exists,
   * use that image.
   */

  if (heroMedia.length === 0 && settings?.hero_image_url) {
    heroMedia = [
      {
        url: settings.hero_image_url,
        type: "image",
      },
    ];
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* =================================================
            Header
            ================================================= */}

        <View style={styles.header}>
          <Text style={styles.greeting}>Welcome to</Text>

          {settings?.hero_title ? (
            <Text
              style={styles.heroTitle}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {settings.hero_title}
            </Text>
          ) : null}
        </View>

        {/* =================================================
            HERO MEDIA
            ================================================= */}

        {heroMedia.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={HERO_WIDTH}
            contentContainerStyle={styles.heroScrollContent}
          >
            {heroMedia.map((media, index) => (
              <View style={styles.heroSlide} key={`${media.url}-${index}`}>
                {media.type === "video" ? (
                  <HeroVideo url={media.url} />
                ) : (
                  <Image
                    source={{ uri: media.url }}
                    style={styles.heroMedia}
                    resizeMode="cover"
                  />
                )}
              </View>
            ))}
          </ScrollView>
        ) : null}

        {/* =================================================
            HERO DESCRIPTION
            ================================================= */}

        {settings?.hero_description ? (
          <View style={styles.heroContent}>
            <Text style={styles.heroText}>{settings.hero_description}</Text>
          </View>
        ) : null}

        {/* =================================================
            PRODUCT COLLECTION HEADER
            ================================================= */}

        <View style={styles.collectionHeader}>
          <View style={styles.collectionText}>
            <Text style={styles.collectionEyebrow}>DISCOVER</Text>

            <Text style={styles.collectionTitle}>Our collection</Text>
          </View>

          <Pressable
            onPress={scrollToCollection}
            style={styles.scrollArrowButton}
          >
            <Animated.Text
              style={[
                styles.scrollArrow,
                {
                  opacity: arrowOpacity,
      transform: [{ scale: arrowScale }],
                },
              ]}
            >
              ↓
            </Animated.Text>
          </Pressable>
        </View>

        {/* =================================================
            PRODUCT STRIPS
            ================================================= */}

        {homepageStrips.length > 0 ? (
          <View>
            {homepageStrips.map((strip) => (
              <View key={strip.id} style={styles.strip}>
                {/* ==========================================
                    STRIP HEADER
                    ========================================== */}

                <View style={styles.sectionHeader}>
                  <Text
                    style={styles.sectionTitle}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {strip.name}
                  </Text>

                  {strip.type === "category" && strip.slug ? (
                    <Pressable
                      onPress={() => {
                        router.push({
                          pathname: "/explore",
                          params: {
                            category: strip.slug,
                          },
                        });
                      }}
                    >
                      <Text style={styles.seeAll}>View all →</Text>
                    </Pressable>
                  ) : strip.type === "all" ? (
                    <Pressable
                      onPress={() => {
                        router.push("/explore");
                      }}
                    >
                      <Text style={styles.seeAll}>View all →</Text>
                    </Pressable>
                  ) : null}
                </View>

                {/* ==========================================
                    PRODUCTS
                    ========================================== */}

                {strip.products.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalList}
                  >
                    {strip.products.map((product) => {
                      const image =
                        Array.isArray(product.images) &&
                        product.images.length > 0
                          ? product.images[0]
                          : null;

                      const price = product.sale_price ?? product.price;

                      return (
                        <Pressable
                          style={styles.productCard}
                          key={product.id}
                          onPress={() => {
                            //console.log("Home product pressed:", product.id);

                            router.push({
                              pathname: "/product/[id]",
                              params: {
                                id: product.id,
                              },
                            });
                          }}
                        >
                          {/* PRODUCT IMAGE */}

                          <View style={styles.productImage}>
                            {image ? (
                              <Image
                                source={{ uri: image }}
                                style={styles.productImageActual}
                                resizeMode="cover"
                              />
                            ) : (
                              <Text style={styles.imagePlaceholder}>
                                No image
                              </Text>
                            )}
                          </View>

                          {/* STICKER */}

                          {product.sticker ? (
                            <Text style={styles.sticker}>
                              {product.sticker}
                            </Text>
                          ) : null}

                          {/* PRODUCT NAME */}

                          <Text
                            style={styles.productName}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {product.name}
                          </Text>

                          {/* PRICE */}

                          <Text style={styles.productPrice}>
                            CHF {Number(price).toFixed(2)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <Text style={styles.emptyStripText}>
                    No products in this strip yet.
                  </Text>
                )}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>
            No homepage product strips have been selected yet.
          </Text>
        )}
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

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: STORE.colors.background,
  },

  loadingText: {
    marginTop: 10,
    color: "#777",
  },

  errorText: {
    color: "#b00020",
    fontSize: 16,
  },

  container: {
    paddingBottom: 30,
  },

  /* =======================================================
     HEADER
     ======================================================= */

  header: {
    paddingHorizontal: 20,
    paddingTop: 1,
    paddingBottom: 8,
  },

  greeting: {
    fontSize: 14,
    color: "#777",
  },

  /* =======================================================
     HERO
     ======================================================= */

  heroScrollContent: {
    paddingHorizontal: 20,
  },

  heroSlide: {
    width: HERO_WIDTH,
    height: HERO_HEIGHT,
    marginRight: 0,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: STORE.colors.background,
  },

  heroMedia: {
    width: "100%",
    height: "100%",
  },

  heroContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },

  heroTitle: {
    fontSize: 25,
    fontWeight: "700",
    color: "#111",
  },

  heroText: {
    fontSize: 15,
    color: "#666",
    marginTop: 7,
    lineHeight: 21,
  },

  /* =======================================================
     COLLECTION
     ======================================================= */

  collectionHeader: {
    paddingHorizontal: 20,
    marginTop: 32,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },

  collectionText: {
    alignItems: "flex-start",
  },

  collectionEyebrow: {
    fontSize: 13,
    fontWeight: "600",
    color: "#a87900",
    letterSpacing: 1.5,
  },

  collectionTitle: {
    fontSize: 28,
    fontWeight: "700",
    marginTop: 5,
  },

  scrollArrowButton: {
    width: 42,
    height: 42,
    marginLeft: 14,
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  scrollArrow: {
  fontSize: 32,
  fontWeight: "400",
  color: "#a87900",
  textShadowColor: "rgba(168, 121, 0, 0.75)",
  textShadowOffset: {
    width: 0,
    height: 0,
  },
  textShadowRadius: 12,
},

  /* =======================================================
     PRODUCT STRIPS
     ======================================================= */

  strip: {
    marginTop: 24,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 14,
  },

  sectionTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    marginRight: 12,
  },

  seeAll: {
    fontSize: 14,
    color: "#777",
  },

  horizontalList: {
    paddingHorizontal: 20,
    gap: 12,
  },

  /* =======================================================
     PRODUCT CARD
     ======================================================= */

  productCard: {
    width: 155,
  },

  productImage: {
    width: 155,
    height: 170,
    borderRadius: 16,
    backgroundColor: STORE.colors.background,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },

  productImageActual: {
    width: "100%",
    height: "100%",
  },

  imagePlaceholder: {
    color: "#999",
  },

  sticker: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
  },

  productName: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 6,
  },

  productPrice: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: "600",
  },

  /* =======================================================
     EMPTY STATES
     ======================================================= */

  emptyStripText: {
    marginHorizontal: 20,
    padding: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#ccc",
    borderRadius: 12,
    color: "#777",
  },

  emptyText: {
    paddingHorizontal: 20,
    color: "#777",
  },
});
