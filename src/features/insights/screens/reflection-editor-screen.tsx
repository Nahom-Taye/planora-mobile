import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { toCalendarDate, type CalendarDate, type ReflectionScope } from '@/domain/entities';
import { ReflectionForm } from '@/features/insights/components/reflection-form';
import { normalizeWeeklyPeriod } from '@/features/insights/services/range-calculations';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useInsights } from '@/providers/insights-provider';
import { useLocalization } from '@/providers/localization-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';
import { goBackOrReplace } from '@/utils/safe-navigation';

export function ReflectionEditorScreen({ create = false }: { create?: boolean }) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const insights = useInsights();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    scope?: string;
    goalId?: string;
    periodStart?: string;
  }>();
  const reflection = create || !params.id ? null : insights.getReflection(params.id);
  const scope = reflection?.scope ?? validScope(params.scope);
  const rawPeriodStart = reflection?.periodStart ?? params.periodStart ?? insights.today ?? '';
  const validPeriodStart = parsePeriodStart(rawPeriodStart, insights.today);
  const periodStart =
    scope === 'week' && insights.profile && validPeriodStart
      ? normalizeWeeklyPeriod(validPeriodStart, insights.profile.weekStartsOn)
      : validPeriodStart ?? '';
  const scopeId = reflection?.scopeId ?? (scope === 'goal' ? params.goalId ?? null : null);
  const goal = insights.goals.find((item) => item.id === scopeId && item.deletedAt === null);

  return (
    <Screen testID={create ? 'create-reflection-screen' : 'edit-reflection-screen'}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={localization.t('common.goBack')}
          accessibilityRole="button"
          onPress={() => goBackOrReplace(router, '/(tabs)/insights')}
          style={styles.iconButton}
        >
          <Ionicons
            color={theme.colors.text}
            name={localization.isRTL ? 'arrow-forward' : 'arrow-back'}
            size={24}
          />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title} variant="heading">
          {localization.t(reflection ? 'reflections.edit' : 'reflections.create')}
        </Text>
        <View style={styles.iconButton} />
      </View>
      {!create && !reflection ? (
        <Card variant="subtle">
          <Text variant="heading">{localization.t('reflections.unavailable')}</Text>
          <Text style={{ marginTop: theme.spacing.sm }} tone="textMuted">
            {localization.t('reflections.unavailableDescription')}
          </Text>
        </Card>
      ) : scope === 'goal' && !goal ? (
        <Card variant="subtle">
          <Text variant="heading">{localization.t('goals.unavailable')}</Text>
          <Text style={{ marginTop: theme.spacing.sm }} tone="textMuted">
            {localization.t('goals.unavailableDescription')}
          </Text>
        </Card>
      ) : (
        <ReflectionForm
          busy={insights.isMutating}
          goalTitle={goal?.title}
          onSubmit={async (draft) => {
            const result = reflection
              ? await insights.updateReflection(reflection, draft)
              : await insights.createReflection(draft);
            if (result.ok) goBackOrReplace(router, '/(tabs)/insights');
            return result;
          }}
          periodStart={periodStart}
          reflection={reflection ?? undefined}
          scope={scope}
          scopeId={scopeId}
        />
      )}
      {reflection ? (
        <Button
          label={localization.t('reflections.delete')}
          onPress={() =>
            Alert.alert(
              localization.t('reflections.deleteTitle'),
              localization.t('reflections.deleteDescription'),
              [
                { text: localization.t('common.cancel'), style: 'cancel' },
                {
                  text: localization.t('reflections.delete'),
                  style: 'destructive',
                  onPress: () =>
                    void insights.deleteReflection(reflection).then((result) => {
                      if (result.ok) goBackOrReplace(router, '/(tabs)/insights');
                    }),
                },
              ],
            )
          }
          style={{ marginTop: theme.spacing.xl }}
          variant="ghost"
        />
      ) : null}
      {insights.errorMessage ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ marginTop: theme.spacing.lg }}
          tone="danger"
        >
          {localization.message(insights.errorMessage)}
        </Text>
      ) : null}
    </Screen>
  );
}

function validScope(value?: string): ReflectionScope {
  if (value === 'week' || value === 'goal') return value;
  return 'day';
}

function parsePeriodStart(value: string, fallback: CalendarDate | null): CalendarDate | null {
  try {
    return toCalendarDate(value);
  } catch {
    return fallback;
  }
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  iconButton: {
    alignItems: 'center',
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    width: MIN_TOUCH_TARGET,
  },
  title: { flex: 1 },
});
