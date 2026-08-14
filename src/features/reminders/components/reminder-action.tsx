import { useRouter, type Href } from 'expo-router';

import { Button } from '@/components/ui';
import type { ReminderEntityType } from '@/domain/entities';
import { useLocalization } from '@/providers/localization-provider';

export function ReminderAction({
  entityType,
  entityId,
}: {
  entityType: ReminderEntityType;
  entityId: string;
}) {
  const router = useRouter();
  const localization = useLocalization();
  return (
    <Button
      label={localization.t('reminders.manage')}
      onPress={() =>
        router.push({
          pathname: '/(reminders)/reminders/[entityType]/[entityId]',
          params: { entityType, entityId },
        } as unknown as Href)
      }
      variant="secondary"
    />
  );
}
