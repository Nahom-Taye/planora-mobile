import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import type { CalendarDate, PlanBlock, TimeZone } from '@/domain/entities';
import { detectOverlaps } from '@/features/planner/services/capacity';
import { localMinutes } from '@/features/planner/services/calendar-math';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

const HOUR_HEIGHT = 72;

export function DayTimeline({
  blocks,
  date,
  today,
  timeZone,
  dayStartsAt,
}: {
  blocks: PlanBlock[];
  date: CalendarDate;
  today: CalendarDate | null;
  timeZone: TimeZone;
  dayStartsAt: string;
}) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const router = useRouter();
  const firstHour = Math.min(
    Number(dayStartsAt.slice(0, 2)),
    ...blocks.map((block) => Number(block.startTime.slice(0, 2))),
  );
  const lastHour = Math.max(
    22,
    ...blocks.map((block) => Math.min(24, Number(block.endTime.slice(0, 2)) + 1)),
  );
  const hourCount = Math.max(1, lastHour - firstHour);
  const timelineHeight = hourCount * HOUR_HEIGHT;
  const overlaps = new Set(
    detectOverlaps(blocks).flatMap((item) => [item.firstId, item.secondId]),
  );
  const currentMinutes = date === today ? currentLocalMinutes(timeZone) : null;
  const currentTop =
    currentMinutes === null
      ? null
      : ((currentMinutes - firstHour * 60) / 60) * HOUR_HEIGHT;

  return (
    <View
      accessibilityLabel={localization.t('planner.timeline')}
      style={[
        styles.timeline,
        {
          borderColor: theme.colors.divider,
          height: timelineHeight,
        },
      ]}
    >
      {Array.from({ length: hourCount + 1 }, (_, index) => {
        const hour = firstHour + index;
        const top = index * HOUR_HEIGHT;
        return (
          <View key={hour} pointerEvents="none">
            <Text
              style={[
                styles.hourLabel,
                localization.isRTL ? styles.hourLabelRtl : styles.hourLabelLtr,
                { top: Math.max(0, top - 8) },
              ]}
              tone="textMuted"
              variant="caption"
            >
              {localization.formatTime(`${String(hour % 24).padStart(2, '0')}:00`)}
            </Text>
            <View
              style={[
                styles.hourLine,
                localization.isRTL ? styles.hourLineRtl : styles.hourLineLtr,
                { backgroundColor: theme.colors.divider, top },
              ]}
            />
          </View>
        );
      })}

      {blocks.map((block) => {
        const start = localMinutes(block.startTime) - firstHour * 60;
        const end = localMinutes(block.endTime) - firstHour * 60;
        const top = (start / 60) * HOUR_HEIGHT;
        const height = Math.max(MIN_TOUCH_TARGET, ((end - start) / 60) * HOUR_HEIGHT - 3);
        const hasOverlap = overlaps.has(block.id);
        return (
          <Pressable
            accessibilityHint={localization.t('planner.blockDetails')}
            accessibilityLabel={`${localization.formatTime(block.startTime)}–${localization.formatTime(block.endTime)}, ${block.title}, ${localization.t(`common.${block.status}` as 'common.planned')}${hasOverlap ? `, ${localization.t('planner.overlapWarning')}` : ''}`}
            accessibilityRole="button"
            key={block.id}
            onPress={() =>
              router.push({
                pathname: '/(planner)/blocks/[id]',
                params: { id: block.id },
              } as unknown as Href)
            }
            style={({ pressed }) => [
              styles.block,
              localization.isRTL ? styles.blockRtl : styles.blockLtr,
              {
                backgroundColor:
                  block.status === 'cancelled'
                    ? theme.colors.surfaceSubtle
                    : block.status === 'completed'
                      ? theme.colors.accentSoft
                      : theme.colors.surface,
                borderColor: hasOverlap
                  ? theme.colors.warning
                  : theme.colors.border,
                borderRadius: theme.radii.md,
                height,
                opacity: pressed ? 0.75 : block.status === 'cancelled' ? 0.58 : 1,
                top,
              },
            ]}
          >
            <View style={styles.blockTitleRow}>
              {hasOverlap ? (
                <Ionicons color={theme.colors.warning} name="layers-outline" size={16} />
              ) : null}
              <Text numberOfLines={1} style={styles.blockTitle} variant="label">
                {block.title}
              </Text>
            </View>
            <Text numberOfLines={1} tone="textMuted" variant="caption">
              {localization.formatTime(block.startTime)}–{localization.formatTime(block.endTime)}
            </Text>
          </Pressable>
        );
      })}

      {currentTop !== null && currentTop >= 0 && currentTop <= timelineHeight ? (
        <View
          accessibilityLabel={localization.t('planner.currentTime')}
          style={[
            styles.currentLine,
            localization.isRTL ? styles.currentLineRtl : styles.currentLineLtr,
            { backgroundColor: theme.colors.primary, top: currentTop },
          ]}
        >
          <View style={[styles.currentDot, { backgroundColor: theme.colors.primary }]} />
        </View>
      ) : null}
    </View>
  );
}

function currentLocalMinutes(timeZone: TimeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

const styles = StyleSheet.create({
  block: {
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
    position: 'absolute',
  },
  blockLtr: { left: 72, right: 8 },
  blockRtl: { left: 8, right: 72 },
  blockTitle: { flex: 1 },
  blockTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  currentDot: { borderRadius: 5, height: 10, width: 10 },
  currentLine: { alignItems: 'center', height: 2, position: 'absolute' },
  currentLineLtr: { left: 64, right: 8 },
  currentLineRtl: { left: 8, right: 64 },
  hourLabel: { position: 'absolute', width: 58 },
  hourLabelLtr: { left: 0 },
  hourLabelRtl: { right: 0 },
  hourLine: { height: StyleSheet.hairlineWidth, position: 'absolute' },
  hourLineLtr: { left: 64, right: 0 },
  hourLineRtl: { left: 0, right: 64 },
  timeline: { borderTopWidth: StyleSheet.hairlineWidth, position: 'relative' },
});
