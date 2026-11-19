import { type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing } from "@/theme";

import { AppText } from "./AppText";
import { TextButton } from "./TextButton";

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Sheet({ visible, title, onClose, children }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  return (
    <Modal animationType="slide" onRequestClose={onClose} statusBarTranslucent transparent visible={visible}>
      <View style={styles.fill}>
        <Pressable
          accessibilityLabel="Fermer la feuille"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.backdrop}
        />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.dock}>
          <View
            accessibilityViewIsModal
            style={[styles.panel, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
          >
            <View style={styles.handle} />
            <View style={styles.header}>
              <AppText accessibilityRole="header" style={styles.title} variant="headline">
                {title}
              </AppText>
              <TextButton label="Fermer" onPress={onClose} />
            </View>
            <ScrollView
              bounces={false}
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: height * 0.62 }}
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(4, 8, 16, 0.72)",
  },
  dock: {
    justifyContent: "flex-end",
  },
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  title: {
    flex: 1,
  },
  body: {
    gap: spacing.md,
    paddingTop: spacing.md,
  },
});
