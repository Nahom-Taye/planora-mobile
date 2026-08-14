import { useState } from 'react';
import { View } from 'react-native';

import { Button, FormField, Text } from '@/components/ui';
import type {
  Area,
  Goal,
  GoalHorizon,
  GoalProgressMethod,
  GoalStatus,
} from '@/domain/entities';
import type { GoalDraft } from '@/features/goals/services/goal-validation';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';

import { ChoiceChips } from './choice-chips';

export function GoalForm({
  goal,
  areas,
  busy,
  onSubmit,
}: {
  goal?: Goal;
  areas: Area[];
  busy: boolean;
  onSubmit: (draft: GoalDraft) => Promise<{
    ok: boolean;
    fieldErrors?: Record<string, string>;
  }>;
}) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const [title, setTitle] = useState(goal?.title ?? '');
  const [description, setDescription] = useState(goal?.description ?? '');
  const [motivation, setMotivation] = useState(goal?.motivation ?? '');
  const [horizon, setHorizon] = useState<GoalHorizon>(goal?.horizon ?? 'quarter');
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '');
  const [status, setStatus] = useState<GoalStatus>(goal?.status ?? 'active');
  const [areaId, setAreaId] = useState(goal?.areaId ?? '');
  const [progressMethod, setProgressMethod] = useState<GoalProgressMethod>(
    goal?.progressMethod ?? 'milestones',
  );
  const [manualProgress, setManualProgress] = useState(
    String(goal?.manualProgress ?? 0),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    const result = await onSubmit({
      title,
      description,
      motivation,
      horizon,
      targetDate,
      status,
      areaId: areaId || null,
      progressMethod,
      manualProgress,
    });
    setErrors(result.fieldErrors ?? {});
  };

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <FormField
        autoCapitalize="sentences"
        autoFocus={!goal}
        error={localization.message(errors.title)}
        label={localization.t('goals.titleField')}
        maxLength={220}
        onChangeText={setTitle}
        returnKeyType="next"
        value={title}
      />
      <FormField
        error={localization.message(errors.description)}
        label={localization.t('goals.descriptionField')}
        multiline
        onChangeText={setDescription}
        value={description}
      />
      <FormField
        error={localization.message(errors.motivation)}
        label={localization.t('goals.motivationField')}
        multiline
        onChangeText={setMotivation}
        value={motivation}
      />
      <ChoiceChips
        label={localization.t('goals.horizon')}
        onChange={setHorizon}
        options={[
          { value: 'month', label: localization.t('goals.horizonMonth') },
          { value: 'quarter', label: localization.t('goals.horizonQuarter') },
          { value: 'year', label: localization.t('goals.horizonYear') },
          { value: 'someday', label: localization.t('goals.horizonSomeday') },
        ]}
        value={horizon}
      />
      <FormField
        autoCapitalize="none"
        error={localization.message(errors.targetDate)}
        hint={localization.t('goals.targetDateHint')}
        inputMode="numeric"
        label={localization.t('goals.targetDate')}
        onChangeText={setTargetDate}
        placeholder="YYYY-MM-DD"
        value={targetDate}
      />
      <ChoiceChips
        label={localization.t('goals.status')}
        onChange={setStatus}
        options={[
          { value: 'active', label: localization.t('goals.statusActive') },
          { value: 'paused', label: localization.t('goals.statusPaused') },
          { value: 'completed', label: localization.t('goals.statusCompleted') },
          { value: 'abandoned', label: localization.t('goals.statusAbandoned') },
        ]}
        value={status}
      />
      <ChoiceChips
        label={localization.t('goals.progressMethod')}
        onChange={setProgressMethod}
        options={[
          { value: 'milestones', label: localization.t('goals.progressMilestones') },
          { value: 'tasks', label: localization.t('goals.progressTasks') },
          { value: 'manual', label: localization.t('goals.progressManual') },
          { value: 'none', label: localization.t('goals.progressNone') },
        ]}
        value={progressMethod}
      />
      {progressMethod === 'manual' ? (
        <FormField
          error={localization.message(errors.manualProgress)}
          hint={localization.t('goals.manualHint')}
          inputMode="numeric"
          label={localization.t('goals.manualProgress')}
          onChangeText={setManualProgress}
          value={manualProgress}
        />
      ) : null}
      {areas.length ? (
        <ChoiceChips
          label={localization.t('goals.area')}
          onChange={setAreaId}
          options={[
            { value: '', label: localization.t('common.none') },
            ...areas.map((area) => ({ value: area.id, label: area.name })),
          ]}
          value={areaId}
        />
      ) : null}
      {errors.areaId ? (
        <Text tone="danger" variant="caption">
          {localization.message(errors.areaId)}
        </Text>
      ) : null}
      <Button
        label={localization.t(goal ? 'common.save' : 'goals.create')}
        loading={busy}
        onPress={() => void submit()}
      />
    </View>
  );
}
