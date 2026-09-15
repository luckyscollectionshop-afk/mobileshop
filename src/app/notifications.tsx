
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { supabase } from "@/lib/supabase";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  order_id: string | null;
  product_id: string | null;
  read_at: string | null;
  created_at: string;
};

export default function NotificationsScreen() {
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setNotifications([]);
        return;
      }

      const { data, error } = await supabase
        .from("notifications")
        .select(
          "id, type, title, message, order_id, product_id, read_at, created_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Unable to load notifications:", error.message);
        return;
      }

      setNotifications(data ?? []);
    } catch (error) {
      console.error("Unable to load notifications:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();

    let cancelled = false;

    const setupRealtime = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) {
        return;
      }

      const channel = supabase
        .channel(`mobile-notifications-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotification = payload.new as Notification;

            setNotifications((current) => {
              if (
                current.some(
                  (notification) =>
                    notification.id === newNotification.id,
                )
              ) {
                return current;
              }

              return [newNotification, ...current];
            });
          },
        )
        .subscribe((status) => {
          console.log("Notifications realtime status:", status);
        });

      return channel;
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;

    void setupRealtime().then((createdChannel) => {
      if (cancelled) {
        if (createdChannel) {
          void supabase.removeChannel(createdChannel);
        }
        return;
      }

      channel = createdChannel ?? null;
    });

    return () => {
      cancelled = true;

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [loadNotifications]);

  const markAsRead = async (notification: Notification) => {
    if (notification.read_at) {
      return;
    }

    const readAt = new Date().toISOString();

    const { error } = await supabase
      .from("notifications")
      .update({
        read_at: readAt,
      })
      .eq("id", notification.id);

    if (error) {
      console.error("Failed to mark notification as read:", error);
      return;
    }

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id
          ? {
              ...item,
              read_at: readAt,
            }
          : item,
      ),
    );
  };

  const handleNotificationPress = async (
    notification: Notification,
  ) => {
    await markAsRead(notification);

    /*
     * IMPORTANT:
     * This stays completely inside the MOBILE APP.
     *
     * We do NOT open:
     * /orders/... on the web
     * /admin/orders/... on the web
     *
     * We open the mobile Expo Router route:
     * /orders/[id]
     */
    if (notification.order_id) {
      router.push({
        pathname: "/orders/[id]",
        params: {
          id: notification.order_id,
        },
      });

      return;
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    void loadNotifications();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-CH", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const renderNotification = ({
    item,
  }: {
    item: Notification;
  }) => {
    const unread = !item.read_at;
    const hasOrder = Boolean(item.order_id);

    return (
      <Pressable
        onPress={() => void handleNotificationPress(item)}
        style={({ pressed }) => [
          styles.notification,
          unread && styles.unreadNotification,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.iconContainer}>
          <Ionicons
            name={item.order_id ? "bag-handle-outline" : "notifications-outline"}
            size={22}
            color="#8B6B35"
          />
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                unread && styles.unreadTitle,
              ]}
              numberOfLines={2}
            >
              {item.title}
            </Text>

            {unread && <View style={styles.unreadDot} />}
          </View>

          <Text style={styles.message}>{item.message}</Text>

          <Text style={styles.date}>
            {formatDate(item.created_at)}
          </Text>

          {hasOrder && (
            <Text style={styles.tapHint}>
              Tap to view order
            </Text>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>

        {notifications.length > 0 && (
          <Text style={styles.headerCount}>
            {notifications.filter((item) => !item.read_at).length} unread
          </Text>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8B6B35" />
          <Text style={styles.loadingText}>
            Loading notifications...
          </Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Ionicons
            name="notifications-outline"
            size={42}
            color="#999"
          />

          <Text style={styles.emptyTitle}>
            No notifications yet
          </Text>

          <Text style={styles.emptyText}>
            Your order updates will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#8B6B35"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F0DF",
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E4D8BE",
    backgroundColor: "#F7F0DF",
  },

  headerTitle: {
    fontSize: 25,
    fontWeight: "700",
    color: "#241F19",
  },

  headerCount: {
    marginTop: 4,
    fontSize: 13,
    color: "#8B6B35",
  },

  list: {
    padding: 16,
    paddingBottom: 30,
  },

  notification: {
    flexDirection: "row",
    backgroundColor: "#FFFDF8",
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E8DDC6",
  },

  unreadNotification: {
    backgroundColor: "#FFF9EA",
    borderColor: "#D9C28C",
  },

  pressed: {
    opacity: 0.7,
  },

  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EFE3C8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  content: {
    flex: 1,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#2B2721",
  },

  unreadTitle: {
    fontWeight: "800",
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#8B6B35",
    marginTop: 5,
    marginLeft: 8,
  },

  message: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: "#665F54",
  },

  date: {
    marginTop: 7,
    fontSize: 11,
    color: "#999083",
  },

  tapHint: {
    marginTop: 7,
    fontSize: 12,
    fontWeight: "600",
    color: "#8B6B35",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#756D60",
  },

  emptyTitle: {
    marginTop: 14,
    fontSize: 17,
    fontWeight: "700",
    color: "#3A342C",
  },

  emptyText: {
    marginTop: 6,
    fontSize: 13,
    color: "#81786A",
    textAlign: "center",
  },
});
