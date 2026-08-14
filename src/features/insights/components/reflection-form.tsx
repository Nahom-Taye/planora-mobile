import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, FormField, Text } from '@/components/ui';
import type { Reflection, ReflectionScope } from '@/domain/entities';
import type { ReflectionDraft } from '@/features/insights/services/reflection-validation';
import { MAX_REFLECTION_BODY_LENGTH } from '@/features/insights/services/reflection-validation';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';

import { SegmentedControl } from './segmented-control';

export function ReflectionForm({
  reflection,
  scope,
  scopeId,
  periodStart,
  goalTitle,
  busy,
  onSubmit,
}: {
  reflection?: Reflection;
  scope: ReflectionScope;
  scopeId: string | null;
  periodStart: string;
  goalTitle?: string;
  busy: boolean;
  onSubmit: (draft: ReflectionDraft) => Promise<{
    ok: boolean;
    fieldErrors?: Record<string, string>;
  }>;
}) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const [body, setBody] = useState(reflection?.body ?? '');
  const [mood, setMood] = useState<Reflection['mood']>(
    reflection?.mood ?? null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const questions =
    scope === 'goal'
      ? ['reflections.questionGoalProgress', 'reflections.questionGoalNext'] as const
      : scope === 'week'
        ? ['reflections.questionAdjust', 'reflections.questionNextWeek'] as const
        : ['reflections.questionImportant', 'reflections.questionHelped', 'reflections.questionAdjust'] as const;

  const submit = async () => {
    const result = await onSubmit({
      scope,
      scopeId,
      periodStart,
      body,
      mood,
    });
    setErrors(result.fieldErrors ?? {});
  };

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <Card style={{ gap: theme.spacing.xs }} variant="subtle">
        <Text variant="label">
          {localization.t(
            scope === 'day'
              ? 'reflections.daily'
              : scope === 'week'
                ? 'reflections.weekly'
                : 'reflections.goal',
          )}
        </Text>
        <Text tone="textMuted" variant="caption">
          {goalTitle ??
            localization.formatDate(periodStart, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
        </Text>
      </Card>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label">{localization.t('reflections.optionalQuestions')}</Text>
        {questions.map((question) => (
          <Text key={question} tone="textMuted" variant="caption">
            {localization.t(question)}
          </Text>
        ))}
      </View>
      <FormField
        autoFocus={!reflection}
        error={localization.message(errors.body)}
        hint={localization.t('reflections.bodyHint', {
          count: localization.formatNumber(MAX_REFLECTION_BODY_LENGTH),
        })}
        label={localization.t('reflections.body')}
        maxLength={MAX_REFLECTION_BODY_LENGTH + 1}
        multiline
        onChangeText={setBody}
        value={body}
      />
      <SegmentedControl
        label={localization.t('reflections.mood')}
        onChange={setMood}
        options={[
          { value: null, label: localization.t('common.none') },
          { value: 'low', label: localization.t('reflections.moodLow') },
          { value: 'steady', label: localization.t('reflections.moodSteady') },
          { value: 'good', label: localization.t('reflections.moodGood') },
          { value: 'great', label: localization.t('reflections.moodGreat') },
        ]}
        value={mood}
      />
      <Text tone="textMuted" variant="caption">
        {localization.t('reflections.moodLimit')}
      </Text>
      {errors.duplicate || errors.scopeId ? (
        <Text accessibilityLiveRegion="polite" tone="danger" variant="caption">
          {localization.message(errors.duplicate ?? errors.scopeId)}
        </Text>
      ) : null}
      <Button
        label={localization.t(reflection ? 'common.save' : 'reflections.create')}
        loading={busy}
        onPress={() => void submit()}
      />
    </View>
  );
}
