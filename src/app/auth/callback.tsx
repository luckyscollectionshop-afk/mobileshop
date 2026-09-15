
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { STORE } from "@/constants/store";

export default function AuthCallbackScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator
        size="large"
        color={STORE.colors.primary}
      />

      <Text style={styles.text}>
        Completing sign in...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: STORE.colors.background,
  },

  text: {
    marginTop: 15,
    fontSize: 15,
    color: STORE.colors.mutedText,
  },
});
