import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

/*
 * =========================================================
 * NOTIFICATION DISPLAY BEHAVIOR
 * =========================================================
 *
 * When a notification arrives while the app is open,
 * show an alert, sound and badge.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/*
 * =========================================================
 * REGISTER DEVICE FOR PUSH NOTIFICATIONS
 * =========================================================
 */

export async function registerForPushNotifications() {
  /*
   * Push notifications require a physical device.
   *
   * They will NOT work correctly in Expo Go on a simulator/
   * emulator for this purpose.
   */
  if (!Device.isDevice) {
    console.log(
      "Push notifications require a physical Android device.",
    );

    return null;
  }

  /*
   * ---------------------------------------------------------
   * Android notification channel
   * ---------------------------------------------------------
   *
   * Android uses notification channels to control how
   * notifications behave.
   */

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(
      "default",
      {
        name: "Default",
        importance:
          Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#bd9650",
      },
    );
  }

  /*
   * ---------------------------------------------------------
   * Check existing permission
   * ---------------------------------------------------------
   */

  const {
    status: existingStatus,
  } = await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  /*
   * Ask the user if permission has not been granted yet.
   */

  if (existingStatus !== "granted") {
    const {
      status,
    } = await Notifications.requestPermissionsAsync();

    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log(
      "Notification permission was not granted.",
    );

    return null;
  }

  /*
   * ---------------------------------------------------------
   * Get Expo project ID
   * ---------------------------------------------------------
   */

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId;

  if (!projectId) {
    console.error(
      "Expo projectId is missing from app configuration.",
    );

    return null;
  }

  /*
   * ---------------------------------------------------------
   * Get Expo push token
   * ---------------------------------------------------------
   */

  const tokenResponse =
    await Notifications.getExpoPushTokenAsync({
      projectId,
    });

  const expoPushToken =
    tokenResponse.data;

  console.log(
    "Expo push token:",
    expoPushToken,
  );

  /*
   * ---------------------------------------------------------
   * Get logged-in user
   * ---------------------------------------------------------
   */

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error(
      "Unable to get current user:",
      userError.message,
    );

    return expoPushToken;
  }

  if (!user) {
    console.log(
      "No logged-in user. Push token was not saved.",
    );

    return expoPushToken;
  }

  /*
   * ---------------------------------------------------------
   * Save token to Supabase
   * ---------------------------------------------------------
   */

  const { error: saveError } = await supabase
    .from("push_tokens")
    .upsert(
      {
        user_id: user.id,
        expo_push_token: expoPushToken,
        platform: Platform.OS,
        device_name: Device.deviceName ?? null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict:
          "user_id,expo_push_token",
      },
    );

  if (saveError) {
    console.error(
      "Unable to save push token:",
      saveError.message,
    );

    return expoPushToken;
  }

  console.log(
    "✅ Push token saved to Supabase.",
  );

  return expoPushToken;
}

/*
 * =========================================================
 * HANDLE NOTIFICATION TAP
 * =========================================================
 *
 * Called when the user taps a push notification.
 *
 * For order notifications, the notification data should
 * contain the order ID so we can open the mobile order page.
 */

export function setupNotificationResponseListener(
  onNotificationTap: (
    data: Record<string, unknown>,
  ) => void,
) {
  const subscription =
    Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data =
          response.notification.request.content.data;

        console.log(
          "Notification tapped:",
          data,
        );

        onNotificationTap(
          data as Record<string, unknown>,
        );
      },
    );

  return subscription;
}