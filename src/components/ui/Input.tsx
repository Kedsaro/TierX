import { Search, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

interface InputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  hint?: string;
  search?: boolean;
  onClear?: () => void;
  onBlur?: TextInputProps['onBlur'];
  onFocus?: TextInputProps['onFocus'];
}

export function Input({
  label,
  value,
  onChangeText,
  error,
  hint,
  search = false,
  onClear,
  onBlur,
  onFocus,
  ...inputProps
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const border = error ? 'border-[#b93a32]' : isFocused ? 'border-[#176b5b]' : 'border-[#ccd7cf]';

  return (
    <View className="w-full">
      {label ? <Text className="mb-2 text-sm font-semibold text-[#26352e]">{label}</Text> : null}
      <View className={`min-h-12 flex-row items-center rounded-lg border bg-white px-3 ${border}`}>
        {search ? <Search color="#718079" size={18} /> : null}
        <TextInput
          accessibilityLabel={inputProps.accessibilityLabel ?? label}
          className="min-h-11 flex-1 px-2 text-base text-[#17231f]"
          maxFontSizeMultiplier={1.5}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          onChangeText={onChangeText}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor="#85928b"
          value={value}
          {...inputProps}
        />
        {onClear && value.length > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear input" hitSlop={8} onPress={onClear}>
            <X color="#718079" size={18} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text accessibilityRole="alert" className="mt-1 text-sm text-[#a93232]">{error}</Text> : null}
      {!error && hint ? <Text className="mt-1 text-xs text-[#65736c]">{hint}</Text> : null}
    </View>
  );
}