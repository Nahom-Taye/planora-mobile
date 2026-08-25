import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { RepositoryStore } from '../../../domain/repositories/contracts.ts';
import type { PlanningExport } from './export-format.ts';
import { PortableRecordService } from './portable-record-service.ts';

export { exportContainsDeviceIdentifiers } from './export-format.ts';

export class PlanningExportService {
  private readonly records: PortableRecordService;

  constructor(
    repositories: RepositoryStore,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.records = new PortableRecordService(repositories);
  }

  async build(workspaceId: string): Promise<PlanningExport> {
    return {
      format: 'planora-planning-export',
      version: 1,
      exportedAt: this.now().toISOString(),
      records: await this.records.snapshot(workspaceId),
    };
  }

  async share(workspaceId: string, dialogTitle: string) {
    const value = await this.build(workspaceId);
    const date = value.exportedAt.slice(0, 10);
    const filename = `planora-export-${date}.json`;
    const contents = JSON.stringify(value, null, 2);
    if (Platform.OS === 'web') {
      downloadOnWeb(filename, contents);
      return filename;
    }
    if (!(await Sharing.isAvailableAsync())) throw new Error('sharing_unavailable');
    const file = new File(Paths.cache, filename);
    file.create({ overwrite: true });
    try {
      file.write(contents);
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle,
        UTI: 'public.json',
      });
      return filename;
    } finally {
      if (file.exists) file.delete();
    }
  }
}

function downloadOnWeb(filename: string, contents: string) {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') throw new Error('sharing_unavailable');
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
