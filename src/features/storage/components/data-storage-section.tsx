import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useStorage } from '@/providers/storage-provider';

type StatusRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isLast?: boolean;
};

function StatusRow({ icon, label, value, isLast = false }: StatusRowProps) {
  const theme = useAppTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[
        styles.row,
        {
          borderBottomColor: theme.colors.divider,
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.lg,
        },
        isLast && styles.lastRow,
      ]}
    >
      <View
        style={[
          styles.rowIcon,
          {
            backgroundColor: theme.colors.accentSoft,
            borderRadius: theme.radii.md,
          },
        ]}
      >
        <Ionicons color={theme.colors.accent} name={icon} size={21} />
      </View>
      <View style={styles.rowCopy}>
        <Text variant="label">{label}</Text>
        <Text tone="textMuted" variant="caption">
          {value}
        </Text>
      </View>
      <Ionicons
        color={theme.colors.success}
        name="checkmark-circle"
        size={22}
      />
    </View>
  );
}

export function DataStorageSection() {
  const theme = useAppTheme();
  const storage = useStorage();
  const ready = storage.status === 'ready';

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ gap: theme.spacing.md, marginTop: theme.spacing.xxl }}
    >
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="heading">Data and storage</Text>
        <Text tone="textMuted" variant="caption">
          Your planning foundation lives locally on this device.
        </Text>
      </View>
      <Card padded={false}>
        <View style={styles.cardContent}>
          <StatusRow
            icon="phone-portrait-outline"
            label="Local data"
            value={ready ? 'Available on this device' : 'Preparing availability'}
          />
          <StatusRow
            icon="cloud-offline-outline"
            label="Offline readiness"
            value={ready ? 'Ready for offline use' : 'Finishing setup'}
          />
          <StatusRow
            icon="shield-checkmark-outline"
            isLast
            label="Storage state"
            value={ready ? 'Ready' : 'Preparing'}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContent: {
    paddingHorizontal: 20,
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 72,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  rowIcon: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
});
