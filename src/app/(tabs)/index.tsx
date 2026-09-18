import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { VideoView, useVideoPlayer } from "expo-video";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { STORE } from "@/constants/store";

/* =========================================================
   TYPES
   ========================================================= */

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

/* =========================================================
   CONSTANTS
   ========================================================= */

const ALL_PRODUCTS_ID = "__all__";
const PREBOOKING_ID = "__prebooking__";

const SCREEN_WIDTH = Dimensions.get("window").width;

const HERO_WIDTH = SCREEN_WIDTH - 40;
const HERO_HEIGHT = 360;

const PRODUCT_CARD_WIDTH = 155;
const PRODUCT_GAP = 12;
const PRODUCT_ITEM_WIDTH = PRODUCT_CARD_WIDTH + PRODUCT_GAP;

/*
 * Product auto-scroll speed.
 *
 * Smaller number = faster.
 * This is the number of pixels moved on each animation frame.
 */
const PRODUCT_SCROLL_SPEED = 0.55;

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
   HOME SCREEN
   ========================================================= */

export default function HomeScreen() {
  /* =======================================================
     STATE
     ======================================================= */

  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [homepageStrips, setHomepageStrips] = useState<HomepageStrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* =======================================================
     ROUTER
     ======================================================= */

  const router = useRouter();

  /* =======================================================
     HERO CAROUSEL
     ======================================================= */

  const heroCarouselRef = useRef<ScrollView>(null);

  const heroAutoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const heroIndex = useRef(0);

  /* =======================================================
     PRODUCT CAROUSELS
     ======================================================= */

  const productCarouselRefs = useRef<Record<string, ScrollView | null>>({});

  /*
   * Each strip gets its own animation frame.
   *
   * This gives us smooth continuous movement rather than
   * jumping from product to product.
   */
  const productAnimationFrames = useRef<Record<string, number | null>>({});

  const productUserScrolling = useRef<Record<string, boolean>>({});

  /* =======================================================
     BUTTON SHINE ANIMATION
     ======================================================= */

  const buttonShineAnimation = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(1800),

        Animated.timing(buttonShineAnimation, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),

        Animated.timing(buttonShineAnimation, {
          toValue: -1,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [buttonShineAnimation]);

  const buttonShineTranslate = buttonShineAnimation.interpolate({
    inputRange: [-1, 1],
    outputRange: [-120, 120],
  });

  /* =======================================================
     LOAD HOME
     ======================================================= */

  useEffect(() => {
    loadHome();
  }, []);

  /* =======================================================
     LOAD HOMEPAGE DATA
     ======================================================= */

  async function loadHome() {
    try {
      setLoading(true);
      setError(null);

      /* =====================================================
         1. LOAD HOMEPAGE SETTINGS
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
         2. SEPARATE REAL CATEGORIES FROM SPECIAL STRIPS
         ===================================================== */

      const categoryIds = homepageStripIds.filter(
        (id) => id !== ALL_PRODUCTS_ID && id !== PREBOOKING_ID,
      );

      /* =====================================================
         3. LOAD SELECTED CATEGORIES
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
         4. LOAD ALL ACTIVE PRODUCTS
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
         5. SORT ALL PRODUCTS BY NAME
         ===================================================== */

      allProducts.sort((a, b) => a.name.localeCompare(b.name));

      /* =====================================================
         6. LOAD CATEGORY → PRODUCT RELATIONSHIPS
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
         7. BUILD PRODUCTS BY CATEGORY
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
         8. SORT CATEGORY PRODUCTS
         ===================================================== */

      for (const products of productsByCategory.values()) {
        products.sort((a, b) => a.name.localeCompare(b.name));
      }

      /* =====================================================
         9. BUILD HOMEPAGE STRIPS
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
     HERO MEDIA
     ========================================================= */

  const heroMedia: HeroMedia[] = Array.isArray(settings?.hero_media)
    ? settings.hero_media
    : settings?.hero_image_url
      ? [
          {
            url: settings.hero_image_url,
            type: "image",
          },
        ]
      : [];

  /* =========================================================
     HERO AUTO SCROLL
     ========================================================= */

  function startHeroAutoScroll() {
    if (heroAutoScrollTimer.current) {
      clearInterval(heroAutoScrollTimer.current);
    }

    if (heroMedia.length <= 1) {
      return;
    }

    heroAutoScrollTimer.current = setInterval(() => {
      if (heroMedia.length <= 1) {
        return;
      }

      heroIndex.current += 1;

      heroCarouselRef.current?.scrollTo({
        x: HERO_WIDTH * (heroMedia.length + heroIndex.current),
        animated: true,
      });
    }, 3500);
  }

  /* =========================================================
     HERO LOOP HANDLER
     ========================================================= */

  function handleHeroCarouselEnd(event: any) {
    const x = event.nativeEvent.contentOffset.x;

    const currentIndex = Math.round(x / HERO_WIDTH);

    /*
     * We render:
     *
     * [copy 1][copy 2][copy 3]
     *
     * We normally stay in copy 2.
     */

    heroIndex.current = currentIndex - heroMedia.length;

    /* -------------------------------------------------------
       FIRST COPY → MIDDLE COPY
       ------------------------------------------------------- */

    if (currentIndex < heroMedia.length) {
      const newIndex = currentIndex + heroMedia.length;

      heroCarouselRef.current?.scrollTo({
        x: newIndex * HERO_WIDTH,
        animated: false,
      });

      heroIndex.current = newIndex - heroMedia.length;
    } else if (currentIndex >= heroMedia.length * 2) {
      /* -------------------------------------------------------
       THIRD COPY → MIDDLE COPY
       ------------------------------------------------------- */
      const newIndex = currentIndex - heroMedia.length;

      heroCarouselRef.current?.scrollTo({
        x: newIndex * HERO_WIDTH,
        animated: false,
      });

      heroIndex.current = newIndex - heroMedia.length;
    }
  }

  /* =========================================================
     START HERO AUTO SCROLL WHEN HERO DATA EXISTS
     ========================================================= */

  useEffect(() => {
    if (heroMedia.length <= 1) {
      return;
    }

    startHeroAutoScroll();

    return () => {
      if (heroAutoScrollTimer.current) {
        clearInterval(heroAutoScrollTimer.current);

        heroAutoScrollTimer.current = null;
      }
    };
  }, [heroMedia.length]);

  /* =========================================================
     PRODUCT CONTINUOUS AUTO SCROLL
     ========================================================= */

  function startProductAutoScroll(stripId: string, productCount: number) {
    if (productCount <= 1) {
      return;
    }

    stopProductAutoScroll(stripId);

    const animate = () => {
      const ref = productCarouselRefs.current[stripId];

      if (!ref) {
        productAnimationFrames.current[stripId] =
          requestAnimationFrame(animate);

        return;
      }

      /*
       * Do not move while the user is touching /
       * manually scrolling the carousel.
       */

      if (!productUserScrolling.current[stripId]) {
        /*
         * Use a tiny offset on every animation frame.
         * This creates a continuous smooth movement.
         */

        ref.scrollTo({
          x: getCurrentProductScrollOffset(stripId) + PRODUCT_SCROLL_SPEED,
          animated: false,
        });
      }

      productAnimationFrames.current[stripId] = requestAnimationFrame(animate);
    };

    productAnimationFrames.current[stripId] = requestAnimationFrame(animate);
  }

  /* =========================================================
     PRODUCT CURRENT OFFSET
     ========================================================= */

  const productScrollOffsets = useRef<Record<string, number>>({});

  function getCurrentProductScrollOffset(stripId: string) {
    return productScrollOffsets.current[stripId] ?? 0;
  }

  /* =========================================================
     PRODUCT SCROLL HANDLER
     ========================================================= */

  function handleProductScroll(stripId: string, event: any) {
    const x = event.nativeEvent.contentOffset.x;

    productScrollOffsets.current[stripId] = x;
  }

  /* =========================================================
     STOP PRODUCT AUTO SCROLL
     ========================================================= */

  function stopProductAutoScroll(stripId: string) {
    const frame = productAnimationFrames.current[stripId];

    if (frame !== null && frame !== undefined) {
      cancelAnimationFrame(frame);

      productAnimationFrames.current[stripId] = null;
    }
  }

  /* =========================================================
     PRODUCT INFINITE LOOP
     ========================================================= */

  function handleProductCarouselEnd(
    stripId: string,
    event: any,
    productCount: number,
  ) {
    if (productCount <= 1) {
      return;
    }

    const x = event.nativeEvent.contentOffset.x;

    const blockWidth = productCount * PRODUCT_ITEM_WIDTH;

    /*
     * First copy → middle copy
     */

    if (x < blockWidth * 0.5) {
      const newX = x + blockWidth;

      productCarouselRefs.current[stripId]?.scrollTo({
        x: newX,
        animated: false,
      });

      productScrollOffsets.current[stripId] = newX;
    } else if (x >= blockWidth * 2.5) {
      /*
       * Third copy → middle copy
       */
      const newX = x - blockWidth;

      productCarouselRefs.current[stripId]?.scrollTo({
        x: newX,
        animated: false,
      });

      productScrollOffsets.current[stripId] = newX;
    }
  }

  /* =========================================================
     PRODUCT STRIP LIFECYCLE
     ========================================================= */

  useEffect(() => {
    if (homepageStrips.length === 0) {
      return;
    }

    /*
     * Give React Native time to render the ScrollViews
     * before starting their animation.
     */

    const timer = setTimeout(() => {
      homepageStrips.forEach((strip) => {
        if (strip.products.length > 1) {
          productScrollOffsets.current[strip.id] =
            strip.products.length * PRODUCT_ITEM_WIDTH;

          startProductAutoScroll(strip.id, strip.products.length);
        }
      });
    }, 500);

    return () => {
      clearTimeout(timer);

      homepageStrips.forEach((strip) => {
        stopProductAutoScroll(strip.id);
      });
    };
  }, [homepageStrips]);


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
     RENDER
     ========================================================= */

  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <ScrollView        
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* =================================================
            HEADER
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
            HERO CAROUSEL
            ================================================= */}

        {heroMedia.length > 0 ? (
          <ScrollView
            ref={heroCarouselRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={HERO_WIDTH}
            contentOffset={{
              x: HERO_WIDTH * heroMedia.length,
              y: 0,
            }}
            onTouchStart={() => {
              if (heroAutoScrollTimer.current) {
                clearInterval(heroAutoScrollTimer.current);
              }
            }}
            onMomentumScrollEnd={(event) => {
              handleHeroCarouselEnd(event);
              startHeroAutoScroll();
            }}
            contentContainerStyle={styles.heroScrollContent}
          >
            {[...heroMedia, ...heroMedia, ...heroMedia].map((media, index) => (
              <View style={styles.heroSlide} key={`${media.url}-${index}`}>
                {media.type === "video" ? (
                  <HeroVideo url={media.url} />
                ) : (
                  <Image
                    source={{
                      uri: media.url,
                    }}
                    style={styles.heroMedia}
                    contentFit="cover"
                  />
                )}
              </View>
            ))}
          </ScrollView>
        ) : null}

        {/* =================================================
            EXPLORE PRODUCTS BUTTON
            ================================================= */}

        <Pressable
          onPress={() => router.push("/explore")}
          style={({ pressed }) => [
            styles.exploreButton,
            pressed && styles.exploreButtonPressed,
          ]}
        >
          <View style={styles.exploreButtonInner}>
            <Text style={styles.exploreButtonText}>EXPLORE OUR PRODUCTS</Text>

            <Text style={styles.exploreButtonArrow}>→</Text>

            <Animated.View
              pointerEvents="none"
              style={[
                styles.buttonShine,
                {
                  transform: [
                    {
                      translateX: buttonShineTranslate,
                    },
                  ],
                },
              ]}
            />
          </View>
        </Pressable>

        {/* =================================================
            HERO DESCRIPTION
            ================================================= */}

        {settings?.hero_description ? (
          <View style={styles.heroContent}>
            <Text style={styles.heroText}>{settings.hero_description}</Text>
          </View>
        ) : null}

        {/* =================================================
            COLLECTION HEADER
            ================================================= */}

        <View style={styles.collectionHeader}>
          <View style={styles.collectionText}>
            <Text style={styles.collectionEyebrow}>DISCOVER</Text>

            <Text style={styles.collectionTitle}>Our collection</Text>
          </View>
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
                    ref={(ref) => {
                      productCarouselRefs.current[strip.id] = ref;
                    }}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    decelerationRate="fast"
                    scrollEventThrottle={16}
                    onScroll={(event) => {
                      handleProductScroll(strip.id, event);
                    }}
                    onTouchStart={() => {
                      productUserScrolling.current[strip.id] = true;

                      stopProductAutoScroll(strip.id);
                    }}
                    onMomentumScrollEnd={(event) => {
                      handleProductCarouselEnd(
                        strip.id,
                        event,
                        strip.products.length,
                      );

                      productUserScrolling.current[strip.id] = false;

                      startProductAutoScroll(strip.id, strip.products.length);
                    }}
                    contentOffset={{
                      x: strip.products.length * PRODUCT_ITEM_WIDTH,
                      y: 0,
                    }}
                    contentContainerStyle={styles.horizontalList}
                  >
                    {[
                      ...strip.products,
                      ...strip.products,
                      ...strip.products,
                    ].map((product, index) => {
                      const image = Array.isArray(product.images)
                        ? (product.images.find(
                            (item) =>
                              typeof item === "string" &&
                              item.trim().length > 0,
                          ) ?? null)
                        : null;

                      const price = product.sale_price ?? product.price;

                      return (
                        <Pressable
                          style={styles.productCard}
                          key={`${product.id}-${index}`}
                          onPress={() => {
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
                                source={image}
                                style={styles.productImageActual}
                                contentFit="cover"
                                transition={150}
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
  /* =======================================================
     GENERAL
     ======================================================= */

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
    paddingBottom: 18,
  },

  greeting: {
    fontSize: 14,
    color: "#777",
  },

  heroTitle: {
    fontSize: 25,
    fontWeight: "700",
    color: "#a87900",
    textAlign: "center",
    paddingTop: 5,
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

  heroText: {
    fontSize: 15,
    color: "#666",
    marginTop: 7,
    lineHeight: 21,
  },

  /* =======================================================
     EXPLORE BUTTON
     ======================================================= */

  exploreButton: {
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 4,
    borderRadius: 16,
    overflow: "hidden",

    borderWidth: 1,
    borderColor: "#d4af37",

    shadowColor: "#a87900",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 5,
  },

  exploreButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },

  exploreButtonInner: {
    height: 58,
    borderRadius: 15,
    backgroundColor: "#c9a227",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    overflow: "hidden",

    borderTopWidth: 1,
    borderTopColor: "#f8e7a1",

    borderBottomWidth: 1,
    borderBottomColor: "#8c6500",
  },

  exploreButtonText: {
    color: "#fffdf3",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.5,

    textShadowColor: "rgba(90, 60, 0, 0.45)",

    textShadowOffset: {
      width: 0,
      height: 1,
    },

    textShadowRadius: 2,
  },

  exploreButtonArrow: {
    color: "#fffdf3",
    fontSize: 22,
    fontWeight: "400",
    marginLeft: 12,
    marginTop: -2,
  },

  buttonShine: {
    position: "absolute",
    width: 35,
    height: 100,
    backgroundColor: "rgba(255, 255, 255, 0.38)",
    transform: [
      {
        rotate: "22deg",
      },
    ],
  },

  /* =======================================================
     COLLECTION HEADER
     ======================================================= */

  collectionHeader: {
    paddingHorizontal: 20,
    marginTop: 32,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
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
    gap: PRODUCT_GAP,
  },

  /* =======================================================
     PRODUCT CARD
     ======================================================= */

  productCard: {
    width: PRODUCT_CARD_WIDTH,
  },

  productImage: {
    width: PRODUCT_CARD_WIDTH,
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
