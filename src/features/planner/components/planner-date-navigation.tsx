import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { toCalendarDate, type CalendarDate } from '@/domain/entities';
import { Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

export function PlannerDateNavigation({
  date,
  onChange,
  onMove,
  onToday,
  mode,
}: {
  date: CalendarDate;
  onChange: (date: CalendarDate) => void;
  onMove: (amount: number) => void;
  onToday: () => void;
  mode: 'day' | 'week';
}) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const [input, setInput] = useState<string>(date);

  useEffect(() => setInput(date), [date]);

  const apply = () => {
    try {
      onChange(toCalendarDate(input));
    } catch {
      setInput(date);
    }
  };
  const previousLabel = localization.t(
    mode === 'day' ? 'planner.previousDay' : 'planner.previousWeek',
  );
  const nextLabel = localization.t(
    mode === 'day' ? 'planner.nextDay' : 'planner.nextWeek',
  );

  return (
    <View style={[styles.container, { gap: theme.spacing.sm }]}>
      <Pressable
        accessibilityLabel={previousLabel}
        accessibilityRole="button"
        onPress={() => onMove(-1)}
        style={styles.iconButton}
      >
        <Ionicons
          color={theme.colors.text}
          name={localization.isRTL ? 'chevron-forward' : 'chevron-back'}
          size={22}
        />
      </Pressable>
      <View style={styles.dateArea}>
        <Text align="center" variant="label">
          {localization.formatDate(date, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
        <TextInput
          accessibilityLabel={localization.t('planner.date')}
          autoCapitalize="none"
          inputMode="numeric"
          onBlur={apply}
          onChangeText={setInput}
          onSubmitEditing={apply}
          selectTextOnFocus
          style={[
            styles.dateInput,
            theme.typography.caption,
            { color: theme.colors.textMuted },
          ]}
          value={input}
        />
      </View>
      <Pressable
        accessibilityLabel={nextLabel}
        accessibilityRole="button"
        onPress={() => onMove(1)}
        style={styles.iconButton}
      >
        <Ionicons
          color={theme.colors.text}
          name={localization.isRTL ? 'chevron-back' : 'chevron-forward'}
          size={22}
        />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onToday}
        style={[
          styles.todayButton,
          {
            borderColor: theme.colors.border,
            borderRadius: theme.radii.pill,
          },
        ]}
      >
        <Text tone="primary" variant="caption">
          {mode === 'day'
            ? localization.t('common.today')
            : localization.t('planner.currentWeek')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dateArea: {
    alignItems: 'center',
    flex: 1,
    minWidth: 150,
  },
  dateInput: {
    minHeight: 28,
    minWidth: 100,
    padding: 0,
    textAlign: 'center',
  },
  iconButton: {
    alignItems: 'center',
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    width: MIN_TOUCH_TARGET,
  },
  todayButton: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 14,
  },
});
