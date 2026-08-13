import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import type { LanguagePreference } from '@/domain/entities';
import {
  languageNames,
  supportedLanguages,
} from '@/features/localization';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

export function LanguageSettingsSection() {
  const theme = useAppTheme();
  const localization = useLocalization();
  const [saving, setSaving] = useState<LanguagePreference | null>(null);
  const preference = localization.settings?.languagePreference ?? 'system';
  const options: { value: LanguagePreference; label: string }[] = [
    { value: 'system', label: localization.t('settings.systemLanguage') },
    ...supportedLanguages.map((language) => ({
      value: language,
      label: languageNames[language],
    })),
  ];

  return (
    <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.xxl }}>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="heading">{localization.t('settings.language')}</Text>
        <Text tone="textMuted" variant="caption">
          {localization.t('settings.languageDescription')}
        </Text>
      </View>
      <Card padded={false}>
        {options.map((option, index) => {
          const selected = preference === option.value;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ busy: saving === option.value, checked: selected }}
              disabled={saving !== null}
              key={option.value}
              onPress={() => {
                setSaving(option.value);
                void localization.setLanguage(option.value).finally(() => setSaving(null));
              }}
              style={[
                styles.row,
                {
                  borderBottomColor: theme.colors.divider,
                  paddingHorizontal: theme.spacing.lg,
                },
                index === options.length - 1 && styles.last,
              ]}
            >
              <Text style={styles.label} variant="label">{option.label}</Text>
              <Ionicons
                color={selected ? theme.colors.primary : theme.colors.textMuted}
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={22}
              />
            </Pressable>
          );
        })}
      </Card>
      {localization.requiresDirectionRestart ? (
        <Text accessibilityLiveRegion="polite" tone="warning" variant="caption">
          {localization.t('settings.directionRestart')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { flex: 1 },
  last: { borderBottomWidth: 0 },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: MIN_TOUCH_TARGET + 8,
  },
});
