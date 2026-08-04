import { toInstant } from '../../../domain/entities/common.ts';
import type { AccountProfile } from '../../../domain/entities/account.ts';
import type { Database } from './database-types.ts';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export function mapProfileRow(row: ProfileRow): AccountProfile {
  return {
    accountId: row.user_id,
    displayName: row.display_name,
    locale: row.locale,
    timeZone: row.time_zone,
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
  };
}
