import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type ScreenProps = {
  children: ReactNode;
  /** Scrollable content (default) or a fixed layout. */
  scroll?: boolean;
  /** Safe-area edges to pad. Screens under a native header usually skip 'top'. */
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  /** Pinned to the bottom, above the keyboard (e.g. a primary button). */
  footer?: ReactNode;
};

/** Standard screen container: background, safe areas, keyboard handling, padding. */
export function Screen({ children, scroll = true, edges = ['top', 'bottom'], contentStyle, footer }: ScreenProps) {
  const { colors } = useTheme();
  const content = [styles.content, contentStyle];

  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentInsetAdjustmentBehavior="automatic">
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.root, content]}>{children}</View>
        )}
        {footer && <View style={styles.footer}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: space.xl, gap: space.lg, flexGrow: 1 },
  footer: { paddingHorizontal: space.xl, paddingBottom: space.md, paddingTop: space.sm, gap: space.sm },
});
