import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Animated, Text, View } from 'react-native';
import { colors } from '@cinelog/shared';
import { F } from './ui';

type Tone = 'success' | 'error' | 'info';
const Ctx = createContext<(msg: string, tone?: Tone) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; tone: Tone } | null>(null);
  const op = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((text: string, tone: Tone = 'success') => {
    setMsg({ text, tone }); clearTimeout(timer.current);
    Animated.timing(op, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    timer.current = setTimeout(() => Animated.timing(op, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setMsg(null)), 2800);
  }, [op]);
  const c = msg?.tone === 'error' ? colors.notify : msg?.tone === 'info' ? colors.lavender : colors.success;
  return (
    <Ctx.Provider value={show}>
      {children}
      {msg && (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 100, opacity: op, alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.surfaceRaised, borderColor: c, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text style={{ color: colors.text, fontFamily: F.bm }}>{msg.text}</Text>
          </View>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}
