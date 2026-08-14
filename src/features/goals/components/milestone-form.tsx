import { useState } from 'react';
import { View } from 'react-native';

import { Button, FormField } from '@/components/ui';
import type { Milestone, MilestoneStatus } from '@/domain/entities';
import type { MilestoneDraft } from '@/features/goals/services/milestone-validation';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';

import { ChoiceChips } from './choice-chips';

export function MilestoneForm({
  milestone,
  busy,
  onSubmit,
}: {
  milestone?: Milestone;
  busy: boolean;
  onSubmit: (draft: MilestoneDraft) => Promise<{
    ok: boolean;
    fieldErrors?: Record<string, string>;
  }>;
}) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const [title, setTitle] = useState(milestone?.title ?? '');
  const [notes, setNotes] = useState(milestone?.notes ?? '');
  const [targetDate, setTargetDate] = useState(milestone?.targetDate ?? '');
  const [status, setStatus] = useState<MilestoneStatus>(milestone?.status ?? 'pending');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    const result = await onSubmit({ title, notes, targetDate, status });
    setErrors(result.fieldErrors ?? {});
  };

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <FormField
        autoFocus={!milestone}
        error={localization.message(errors.title)}
        label={localization.t('goals.milestoneTitle')}
        onChangeText={setTitle}
        value={title}
      />
      <FormField
        error={localization.message(errors.notes)}
        label={localization.t('goals.milestoneNotes')}
        multiline
        onChangeText={setNotes}
        value={notes}
      />
      <FormField
        autoCapitalize="none"
        error={localization.message(errors.targetDate)}
        hint={localization.t('goals.targetDateHint')}
        inputMode="numeric"
        label={localization.t('goals.milestoneDate')}
        onChangeText={setTargetDate}
        placeholder="YYYY-MM-DD"
        value={targetDate}
      />
      <ChoiceChips
        label={localization.t('goals.status')}
        onChange={setStatus}
        options={[
          { value: 'pending', label: localization.t('goals.milestonePending') },
          { value: 'completed', label: localization.t('goals.milestoneCompleted') },
          { value: 'cancelled', label: localization.t('goals.milestoneCancelled') },
        ]}
        value={status}
      />
      <Button
        label={localization.t(milestone ? 'common.save' : 'goals.addMilestone')}
        loading={busy}
        onPress={() => void submit()}
      />
    </View>
  );
}
