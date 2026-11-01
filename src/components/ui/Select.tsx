import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Modal } from './Modal';

export interface SelectOption<T extends string | number> {
  label: string;
  value: T;
}

interface SelectProps<T extends string | number> {
  label?: string;
  value: T | undefined;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  error?: string;
  accessibilityLabel?: string;
}

export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  error,
  accessibilityLabel,
}: SelectProps<T>) {
  const [visible, setVisible] = useState(false);
  const selected = options.find((option) => option.value === value);
  const border = error ? 'border-[#b93a32]' : 'border-[#ccd7cf]';

  return (
    <View className="w-full">
      {label ? <Text className="mb-2 text-sm font-semibold text-[#26352e]">{label}</Text> : null}
      <Pressable
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="button"
        className={`min-h-12 flex-row items-center justify-between rounded-lg border bg-white px-3 ${border}`}
        onPress={() => setVisible(true)}
      >
        <Text className={`text-base ${selected ? 'text-[#17231f]' : 'text-[#85928b]'}`} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown color="#718079" size={18} />
      </Pressable>
      {error ? <Text accessibilityRole="alert" className="mt-1 text-sm text-[#a93232]">{error}</Text> : null}

      <Modal onClose={() => setVisible(false)} title={label ?? placeholder} visible={visible}>
        <View className="gap-2">
          {options.length === 0 ? (
            <Text className="text-sm text-[#65736c]">No options available.</Text>
          ) : (
            options.map((option) => {
              const isSelected = option.value === value;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  className={`min-h-11 justify-center rounded-lg border px-4 ${isSelected ? 'border-[#176b5b] bg-[#e1eee8]' : 'border-[#dfe7e1] bg-white'}`}
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setVisible(false);
                  }}
                >
                  <Text className={`text-sm font-semibold ${isSelected ? 'text-[#176b5b]' : 'text-[#26352e]'}`}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      </Modal>
    </View>
  );
}
