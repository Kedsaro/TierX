import { Calendar, Clock } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { snapToFiveMinutes } from '../../tournaments/validation';

interface DateTimeFieldProps {
  label: string;
  /** Current value as `YYYY-MM-DD HH:MM`, or empty when unset. */
  value: string;
  /** Called with the new value as `YYYY-MM-DD HH:MM`. */
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  /** Earliest selectable instant. Defaults to now + 24 hours (RF-20). */
  minimumDate?: Date;
  /** Latest selectable instant, if the field has an upper bound (e.g. registration closing before the tournament starts). */
  maximumDate?: Date;
  placeholder?: string;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toFieldValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseFieldValue(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDisplay(value: string): string {
  const date = parseFieldValue(value);
  if (!date) return '';
  const datePart = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  const timePart = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

function defaultMinimumDate(): Date {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

/** Rounds a date's minutes up to the next multiple of 5, so it stays a valid lower bound. */
function ceilToFiveMinutes(date: Date): Date {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  rounded.setMinutes(Math.ceil(rounded.getMinutes() / 5) * 5);
  return rounded;
}

/** Rounds a date's minutes down to the previous multiple of 5, so it stays a valid upper bound. */
function floorToFiveMinutes(date: Date): Date {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  rounded.setMinutes(Math.floor(rounded.getMinutes() / 5) * 5);
  return rounded;
}

/**
 * Date + time picker that opens the native calendar dialog followed by the
 * native clock dialog. Manual text entry is intentionally unsupported
 * (RF-20): the only way to set a value is through the pickers, any instant
 * earlier than `minimumDate` (Hoy + 24h by default) or later than
 * `maximumDate` is rejected, and every selected time is snapped to the
 * nearest 5-minute mark (Android's native clock dialog has no built-in
 * minute-interval restriction, so this is enforced after selection).
 */
export function DateTimeField({
  label,
  value,
  onChange,
  error,
  hint,
  minimumDate,
  maximumDate,
  placeholder = 'Select date and time',
}: DateTimeFieldProps) {
  const [stage, setStage] = useState<'none' | 'date' | 'time'>('none');
  const [pendingDate, setPendingDate] = useState<Date | null>(null);
  const border = error ? 'border-[#b93a32]' : 'border-[#ccd7cf]';
  const display = formatDisplay(value);
  // Rounded so both bounds stay on a 5-minute mark (RF-20: only multiples of
  // 5 minutes are selectable), without ever allowing a value outside the
  // original, unrounded range.
  const minDate = ceilToFiveMinutes(minimumDate ?? defaultMinimumDate());
  const flooredMaxDate = maximumDate ? floorToFiveMinutes(maximumDate) : undefined;
  const maxDate = flooredMaxDate && flooredMaxDate.getTime() >= minDate.getTime() ? flooredMaxDate : undefined;

  function clampToRange(date: Date): Date {
    if (date.getTime() < minDate.getTime()) return minDate;
    if (maxDate && date.getTime() > maxDate.getTime()) return maxDate;
    return date;
  }

  function openPicker() {
    const current = parseFieldValue(value);
    setPendingDate(current ? clampToRange(snapToFiveMinutes(current)) : minDate);
    setStage('date');
  }

  function handleDismiss() {
    setStage('none');
  }

  function handleDateChange(_event: DateTimePickerChangeEvent, selected: Date) {
    setStage('none');
    const next = new Date(selected);
    if (pendingDate) {
      next.setHours(pendingDate.getHours(), pendingDate.getMinutes());
    }
    setPendingDate(next);
    setStage('time');
  }

  function handleTimeChange(_event: DateTimePickerChangeEvent, selected: Date) {
    setStage('none');
    if (!pendingDate) return;
    const next = new Date(pendingDate);
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    // RF-20: only multiples of 5 minutes are allowed. Android's native clock
    // dialog does not support restricting minute granularity on its own, so
    // any selection is snapped to the nearest 5-minute mark here.
    onChange(toFieldValue(clampToRange(snapToFiveMinutes(next))));
  }

  return (
    <View className="w-full">
      {label ? <Text className="mb-2 text-sm font-semibold text-[#26352e]">{label}</Text> : null}
      <Pressable
        accessibilityHint="Opens a calendar and clock picker. Manual text entry is not allowed."
        accessibilityLabel={label}
        accessibilityRole="button"
        className={`min-h-12 flex-row items-center justify-between rounded-lg border bg-white px-3 ${border}`}
        onPress={openPicker}
      >
        <Text className={`text-base ${display ? 'text-[#17231f]' : 'text-[#85928b]'}`} numberOfLines={1}>
          {display || placeholder}
        </Text>
        <View className="flex-row items-center gap-2">
          <Calendar color="#718079" size={16} />
          <Clock color="#718079" size={16} />
        </View>
      </Pressable>
      {error ? <Text accessibilityRole="alert" className="mt-1 text-sm text-[#a93232]">{error}</Text> : null}
      {!error && hint ? <Text className="mt-1 text-xs text-[#65736c]">{hint}</Text> : null}

      {stage === 'date' ? (
        <DateTimePicker
          maximumDate={maxDate}
          minimumDate={minDate}
          mode="date"
          onDismiss={handleDismiss}
          onValueChange={handleDateChange}
          value={pendingDate ?? minDate}
        />
      ) : null}
      {stage === 'time' ? (
        <DateTimePicker minuteInterval={5} mode="time" onDismiss={handleDismiss} onValueChange={handleTimeChange} value={pendingDate ?? minDate} />
      ) : null}
    </View>
  );
}
