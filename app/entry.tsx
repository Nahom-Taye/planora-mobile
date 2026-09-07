import { Redirect } from 'expo-router';

import { openingRoute } from '@/features/auth/services/app-entry';
import { useAccount } from '@/providers/account-provider';
import { useAppEntry } from '@/providers/app-entry-provider';
import { useOnboarding } from '@/providers/onboarding-provider';

export default function EntryScreen() {
  const account = useAccount();
  const entry = useAppEntry();
  const onboarding = useOnboarding();
  const href = openingRoute(entry.destination, account.status, onboarding.isReviewing, entry.continuedLocally);
  return href ? <Redirect href={href} /> : null;
}
