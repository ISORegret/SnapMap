/**
 * Light haptic feedback when on native (Capacitor).
 * No-op on web so it's safe to call everywhere.
 */
export async function hapticLight() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Haptics not available (web or plugin missing)
  }
}
