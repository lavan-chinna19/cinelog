import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, TAGLINE } from '@cinelog/shared';
import { supabaseConfigured } from '@/lib/supabase';
import { Card, T } from '@/components/ui';

export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient colors={['rgba(240,163,94,.18)', 'transparent', 'rgba(167,139,250,.14)']} style={{ position: 'absolute', inset: 0 } as any} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 22, gap: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: 10 }}>
          <LinearGradient colors={[colors.amber, colors.lavender]} style={{ width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="film" size={28} color={colors.bg} />
          </LinearGradient>
          <T v="h1">Cine<T v="h1" style={{ color: colors.amber }}>Log</T></T>
          <T v="accent" style={{ fontSize: 14, color: colors.textMuted }}>{TAGLINE}</T>
        </View>
        {!supabaseConfigured && <Card style={{ borderColor: colors.amber }}><T v="small" style={{ color: colors.amber }}>Supabase isn't configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to apps/mobile/.env.</T></Card>}
        <Card style={{ padding: 20, gap: 14 }}>{children}</Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
