/**
 * Barcode scanner. Point at a product's barcode: found products open the
 * logging screen; unknown ones open "new food" with the barcode filled in.
 */
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, View } from 'react-native';

import { Button, EmptyState, Text } from '@/components/ui';
import type { Meal } from '@/features/api/types';
import { lookupBarcode } from '@/features/food/queries';
import { useRecipeDraft } from '@/features/food/recipeDraft';
import { radius, space } from '@/theme/tokens';

export default function ScanScreen() {
  const p = useLocalSearchParams<{ meal?: Meal; date?: string; mode?: 'ingredient' }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<'scanning' | 'looking' | 'error'>('scanning');
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  const onScanned = async ({ data }: BarcodeScanningResult) => {
    if (handled.current) return; // the camera reports the same code many times a second
    handled.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStatus('looking');
    try {
      const food = await lookupBarcode(data);
      if (!food) {
        router.replace({ pathname: '/food/custom', params: { barcode: data, meal: p.meal, date: p.date, mode: p.mode } });
      } else if (p.mode === 'ingredient') {
        useRecipeDraft.getState().addIngredient(food);
        router.back();
      } else {
        router.replace({ pathname: '/food/item', params: { foodId: food.id, meal: p.meal, date: p.date } });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed');
      setStatus('error');
    }
  };

  if (Platform.OS === 'web') {
    return <EmptyState icon="barcode-outline" title="Scanning needs the phone app" message="Open Progression on your phone to scan barcodes." />;
  }
  if (!permission) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!permission.granted) {
    return (
      <EmptyState
        icon="camera-outline"
        title="Camera access"
        message="Progression uses the camera only to read food barcodes."
        action={
          permission.canAskAgain ? (
            <Button title="Allow camera" fullWidth={false} onPress={requestPermission} />
          ) : (
            <Button title="Open Settings" variant="secondary" fullWidth={false} onPress={() => Linking.openSettings()} />
          )
        }
      />
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Scan Barcode' }} />
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={status === 'scanning' ? onScanned : undefined}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.frame} />
        <View style={styles.message}>
          {status === 'looking' ? (
            <ActivityIndicator color="#fff" />
          ) : status === 'error' ? (
            <>
              <Text variant="subhead" style={styles.light} align="center">
                {error}
              </Text>
              <Button
                title="Try again"
                size="sm"
                fullWidth={false}
                onPress={() => {
                  handled.current = false;
                  setStatus('scanning');
                }}
              />
            </>
          ) : (
            <Text variant="subhead" style={styles.light} align="center">
              Line up the barcode inside the frame
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: space.xl },
  frame: { width: '78%', aspectRatio: 1.8, borderWidth: 3, borderColor: '#fff', borderRadius: radius.lg },
  message: { alignItems: 'center', gap: space.md, paddingHorizontal: space.xl },
  light: { color: '#fff' },
});
