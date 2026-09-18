import * as Notifications from "expo-notifications";
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  router,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useColorScheme } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import SiteHeader from "@/components/SiteHeader";

SplashScreen.preventAutoHideAsync();

/*
 * =========================================================
 * NOTIFICATION NAVIGATION
 * =========================================================
 *
 * Handles:
 *
 * 1. User taps a notification while the app is running.
 * 2. User taps a notification while the app is in background.
 * 3. User taps a notification that launches the app
 *    from a completely closed state.
 *
 * We keep all navigation inside the MOBILE APP.
 */
function useNotificationObserver() {
  useEffect(() => {
    let mounted = true;

    /*
     * -------------------------------------------------------
     * Navigate according to notification data
     * -------------------------------------------------------
     */

    const handleNotification = (notification: Notifications.Notification) => {
      if (!mounted) {
        return;
      }
      //console.log("Handling notification:", notification);
      const data = notification.request.content.data as
        | {
            order_id?: unknown;
            product_id?: unknown;
            type?: unknown;
          }
        | undefined;

      //console.log("Notification data:", data);

      /*
       * -----------------------------------------------------
       * ORDER NOTIFICATION
       * -----------------------------------------------------
       *
       * Example data:
       *
       * {
       *   type: "order",
       *   order_id: "..."
       * }
       */

      if (typeof data?.order_id === "string" && data.order_id.length > 0) {
        const isAdminNotification =
          typeof data?.type === "string" && data.type.startsWith("admin_");

        //console.log(          isAdminNotification            ? "Opening admin order:"           : "Opening mobile order:",          data.order_id,       );

        setTimeout(() => {
          if (!mounted) {
            return;
          }

          if (isAdminNotification) {
            router.push({
              pathname: "/admin/order/[id]",
              params: {
                id: data.order_id as string,
              },
            });
          } else {
            router.push({
              pathname: "/orders/[id]",
              params: {
                id: data.order_id as string,
              },
            });
          }
        }, 300);

        return;
      }

      /*
       * -----------------------------------------------------
       * PRODUCT NOTIFICATION
       * -----------------------------------------------------
       *
       * We can add product navigation later if needed.
       */

      if (typeof data?.product_id === "string" && data.product_id.length > 0) {
       // console.log("Opening mobile product:", data.product_id);

        setTimeout(() => {
          if (!mounted) {
            return;
          }

          router.push({
            pathname: "/product/[id]",
            params: {
              id: data.product_id as string,
            },
          });
        }, 300);
      }
    };

    /*
     * -------------------------------------------------------
     * APP ALREADY RUNNING / BACKGROUND
     * -------------------------------------------------------
     *
     * Fires when the user taps a notification.
     */
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        //console.log("Notification tapped.");

        handleNotification(response.notification);
      });

    /*
     * -------------------------------------------------------
     * APP WAS COMPLETELY CLOSED
     * -------------------------------------------------------
     *
     * If the notification launched the application,
     * the response listener alone may not be enough.
     *
     * Therefore check the last notification response.
     */
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!mounted || !response) {
          return;
        }

        //console.log("App launched from notification.");

        handleNotification(response.notification);

        /*
         * Prevent the same notification response from
         * being handled again.
         */
        void Notifications.clearLastNotificationResponseAsync();
      })
      .catch((error) => {
        console.log("Unable to read last notification response:", error);
      });

    /*
     * -------------------------------------------------------
     * CLEANUP
     * -------------------------------------------------------
     */

    return () => {
      mounted = false;
      responseSubscription.remove();
    };
  }, []);
}

/*
 * =========================================================
 * ROOT LAYOUT
 * =========================================================
 */

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useNotificationObserver();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />

      <Stack
        screenOptions={{
          headerShown: true,
          header: () => <SiteHeader />,
        }}
      >
        <Stack.Screen name="(tabs)" />

        <Stack.Screen name="product/[id]" />
      </Stack>
    </ThemeProvider>
  );
}
