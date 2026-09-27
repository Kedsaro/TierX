import type { ReactNode } from 'react';
import { Modal as NativeModal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

interface ModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ visible, title, onClose, children, footer }: ModalProps) {
  return (
    <NativeModal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <SafeAreaView className="flex-1 justify-end bg-black/40">
        <Pressable accessibilityLabel="Close dialog" className="flex-1" onPress={onClose} />
        <View accessibilityViewIsModal className="max-h-[85%] rounded-t-2xl bg-[#f4f6f2] px-5 pb-5 pt-3">
          <View className="mb-4 flex-row items-center justify-between border-b border-[#dfe7e1] pb-3">
            <Text accessibilityRole="header" className="text-lg font-bold text-[#17231f]">{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close dialog" hitSlop={10} onPress={onClose}>
              <X color="#4d5d55" size={22} />
            </Pressable>
          </View>
          <View className="shrink">{children}</View>
          {footer ? <View className="mt-5">{footer}</View> : null}
        </View>
      </SafeAreaView>
    </NativeModal>
  );
}