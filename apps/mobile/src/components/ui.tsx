import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput,
  View, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, posterUrl, type PosterSize } from '@cinelog/shared';

export const F = { h: 'SpaceGrotesk_700Bold', hm: 'SpaceGrotesk_600SemiBold', b: 'Inter_400Regular', bm: 'Inter_500Medium', bs: 'Inter_600SemiBold', a: 'PlayfairDisplay_400Regular_Italic' };

export function T({ children, style, v = 'body', numberOfLines }: { children: ReactNode; style?: TextStyle | TextStyle[]; v?: 'h1' | 'h2' | 'h3' | 'body' | 'muted' | 'small' | 'accent'; numberOfLines?: number }) {
  return <Text numberOfLines={numberOfLines} style={[t[v], style as any]}>{children}</Text>;
}
const t = StyleSheet.create({
  h1: { fontFamily: F.h, fontSize: 28, color: colors.text, letterSpacing: -0.5 },
  h2: { fontFamily: F.h, fontSize: 20, color: colors.text },
  h3: { fontFamily: F.hm, fontSize: 16, color: colors.text },
  body: { fontFamily: F.b, fontSize: 15, color: colors.text },
  muted: { fontFamily: F.b, fontSize: 13, color: colors.textMuted },
  small: { fontFamily: F.b, fontSize: 11, color: colors.textMuted },
  accent: { fontFamily: F.a, fontSize: 16, color: colors.lavender },
});

export function Screen({ children, scroll = true, padded = true, refresh }: { children: ReactNode; scroll?: boolean; padded?: boolean; refresh?: ReactNode }) {
  const inner = <View style={[{ flex: scroll ? undefined : 1 }, padded && { padding: 16, gap: 16 }]}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {scroll ? <ScrollView contentContainerStyle={{ paddingBottom: 40 }} refreshControl={refresh as any} keyboardShouldPersistTaps="handled">{inner}</ScrollView> : inner}
    </View>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'lavender';
export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, small, style }: {
  title?: string; onPress?: () => void; variant?: BtnVariant; loading?: boolean; disabled?: boolean; icon?: keyof typeof Ionicons.glyphMap; small?: boolean; style?: ViewStyle;
}) {
  const v = btn[variant];
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} accessibilityRole="button"
      style={({ pressed }) => [b.base, small && b.small, v.box, (disabled || loading) && { opacity: 0.5 }, pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 }, style]}>
      {loading ? <ActivityIndicator color={v.text.color} size="small" /> : icon ? <Ionicons name={icon} size={small ? 15 : 18} color={v.text.color} /> : null}
      {title ? <Text style={[b.text, small && { fontSize: 13 }, v.text]}>{title}</Text> : null}
    </Pressable>
  );
}
const b = StyleSheet.create({
  base: { minHeight: 48, borderRadius: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  small: { minHeight: 36, paddingHorizontal: 12, borderRadius: 10 },
  text: { fontFamily: F.bs, fontSize: 15 },
});
const btn: Record<BtnVariant, { box: ViewStyle; text: TextStyle }> = {
  primary: { box: { backgroundColor: colors.amber }, text: { color: colors.bg } },
  secondary: { box: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border }, text: { color: colors.text } },
  ghost: { box: { backgroundColor: 'transparent' }, text: { color: colors.textMuted } },
  danger: { box: { backgroundColor: 'rgba(241,109,118,.12)', borderWidth: 1, borderColor: 'rgba(241,109,118,.35)' }, text: { color: colors.notify } },
  lavender: { box: { backgroundColor: 'rgba(167,139,250,.15)', borderWidth: 1, borderColor: 'rgba(167,139,250,.35)' }, text: { color: colors.lavender } },
};

export function Field({ label, error, icon, style, ...rest }: TextInputProps & { label?: string; error?: string | null; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={{ gap: 6 }}>
      {label && <T v="muted">{label}</T>}
      <View style={[f.box, error ? { borderColor: colors.notify } : null]}>
        {icon && <Ionicons name={icon} size={18} color={colors.textMuted} />}
        <TextInput placeholderTextColor="#9299AC99" style={[f.input, style]} selectionColor={colors.amber} {...rest} />
      </View>
      {error ? <T v="small" style={{ color: colors.notify }}>{error}</T> : null}
    </View>
  );
}
const f = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(16,19,31,.6)', borderRadius: 14, paddingHorizontal: 14, minHeight: 50 },
  input: { flex: 1, color: colors.text, fontFamily: F.b, fontSize: 15, paddingVertical: 12 },
});

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[{ backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14 }, style as any]}>{children}</View>;
}

export function Poster({ path, size = 'w342', width, radius = 12 }: { path: string | null | undefined; size?: PosterSize; width?: number; radius?: number }) {
  const uri = posterUrl(path, size);
  return (
    <View style={{ width: width ?? '100%', aspectRatio: 2 / 3, borderRadius: radius, overflow: 'hidden', backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border }}>
      {uri ? <Image source={{ uri }} style={{ flex: 1 }} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey={uri} />
        : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="film-outline" size={22} color={colors.textMuted} /></View>}
    </View>
  );
}

export function Avatar({ url, name, size = 40, online }: { url?: string | null; name?: string; size?: number; online?: boolean }) {
  return (
    <View style={{ width: size, height: size }}>
      {url ? <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(167,139,250,.35)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: F.h, color: colors.text, fontSize: size * 0.4 }}>{(name ?? '?').slice(0, 1).toUpperCase()}</Text>
          </View>}
      {online !== undefined && <View style={{ position: 'absolute', right: 0, bottom: 0, width: size * 0.28, height: size * 0.28, borderRadius: size, backgroundColor: online ? colors.success : colors.border, borderWidth: 2, borderColor: colors.bg }} />}
    </View>
  );
}

export function Stars({ value, onChange, size = 18 }: { value: number | null; onChange?: (v: number | null) => void; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} disabled={!onChange} onPress={() => onChange?.(value === n ? null : n)} hitSlop={6} accessibilityLabel={`${n} stars`}>
          <Ionicons name={n <= (value ?? 0) ? 'star' : 'star-outline'} size={size} color={n <= (value ?? 0) ? colors.amber : colors.border} />
        </Pressable>
      ))}
    </View>
  );
}

export function Badge({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'amber' | 'lavender' | 'success' }) {
  const c = { muted: colors.textMuted, amber: colors.amber, lavender: colors.lavender, success: colors.success }[tone];
  return <View style={{ alignSelf: 'flex-start', borderRadius: 99, borderWidth: 1, borderColor: c + '55', backgroundColor: c + '18', paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: c, fontSize: 11, fontFamily: F.bm }}>{text}</Text></View>;
}

export function Chips<V extends string>({ options, value, onChange }: { options: { id: V; label: string }[]; value: V; onChange: (v: V) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {options.map((o) => (
        <Pressable key={o.id} onPress={() => onChange(o.id)}
          style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: value === o.id ? colors.amber : colors.border, backgroundColor: value === o.id ? 'rgba(240,163,94,.12)' : colors.surface }}>
          <Text style={{ color: value === o.id ? colors.amber : colors.textMuted, fontFamily: F.bm, fontSize: 13 }}>{o.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function Skeleton({ h = 16, w = '100%' as any, r = 10, style }: { h?: number; w?: number | string; r?: number; style?: ViewStyle }) {
  const o = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.timing(o, { toValue: 0.9, duration: 700, useNativeDriver: true }), Animated.timing(o, { toValue: 0.4, duration: 700, useNativeDriver: true })]));
    a.start(); return () => a.stop();
  }, [o]);
  return <Animated.View style={[{ height: h, width: w as any, borderRadius: r, backgroundColor: colors.surfaceRaised, opacity: o }, style]} />;
}
export function PosterGridSkeleton({ n = 6 }: { n?: number }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{Array.from({ length: n }).map((_, i) => <View key={i} style={{ width: '30.5%' }}><Skeleton h={160} r={12} /></View>)}</View>;
}

export function Empty({ icon = 'film-outline', title, body, action }: { icon?: keyof typeof Ionicons.glyphMap; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', padding: 28, borderRadius: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, gap: 8 }}>
      <View style={{ width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(240,163,94,.12)' }}><Ionicons name={icon} size={26} color={colors.amber} /></View>
      <T v="h3" style={{ textAlign: 'center' }}>{title}</T>
      {body && <T v="muted" style={{ textAlign: 'center' }}>{body}</T>}
      {action && <View style={{ marginTop: 8 }}>{action}</View>}
    </View>
  );
}
export function ErrorText({ msg, onRetry }: { msg: string; onRetry?: () => void }) {
  return <Pressable onPress={onRetry}><Card style={{ borderColor: 'rgba(241,109,118,.4)' }}><T style={{ color: colors.notify }}>{msg}{onRetry ? '  · Tap to retry' : ''}</T></Card></Pressable>;
}

/** Bottom sheet modal. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}><View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.6)' }} /></Pressable>
        <View style={{ maxHeight: '92%', backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: colors.border, paddingBottom: insets.bottom + 12 }}>
          <View style={{ alignItems: 'center', paddingTop: 10 }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} /></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 }}>
            <T v="h3" style={{ flex: 1 }} numberOfLines={1}>{title}</T>
            <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={24} color={colors.textMuted} /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 12, gap: 14 }}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <T v="h2" style={{ fontSize: 18 }}>{title}</T>
      {action && <Pressable onPress={onAction} hitSlop={8}><T v="muted" style={{ color: colors.lavender }}>{action}</T></Pressable>}
    </View>
  );
}
