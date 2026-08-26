import { useRouter } from 'expo-router';

import { Button, Card, Screen, SectionHeader } from '@/components/ui';
import { useLocalization } from '@/providers/localization-provider';

export default function NotFoundScreen() {
  const router = useRouter();
  const localization = useLocalization();

  return (
    <Screen contentStyle={{ justifyContent: 'center' }} testID="not-found-screen">
      <Card>
        <SectionHeader
          description={localization.t('notFound.description')}
          eyebrow={localization.t('notFound.eyebrow')}
          title={localization.t('notFound.title')}
        />
        <Button
          label={localization.t('notFound.today')}
          onPress={() => router.replace('/')}
        />
      </Card>
    </Screen>
  );
}
