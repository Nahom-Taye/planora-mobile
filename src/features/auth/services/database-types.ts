export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          display_name: string;
          locale: string;
          time_zone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          display_name?: string;
          locale: string;
          time_zone: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string;
          locale?: string;
          time_zone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      apply_planning_operation: {
        Args: { p_operation_id: string; p_entity_type: string; p_entity_id: string; p_workspace_id: string; p_base_revision: number; p_payload: Json; p_deleted: boolean };
        Returns: { status: string; applied_revision: number; applied_cursor: number; remote_payload: Json | null; remote_deleted: boolean }[];
      };
      pull_planning_changes: {
        Args: { p_workspace_id: string; p_after_cursor: number; p_batch_limit: number };
        Returns: { entity_type: string; entity_id: string; remote_workspace_id: string; revision: number; change_cursor: number; deleted: boolean; payload: Json }[];
      };
      list_owned_planning_workspaces: {
        Args: Record<never, never>;
        Returns: { remote_workspace_id: string; revision: number; change_cursor: number; deleted: boolean; payload: Json }[];
      };
      delete_my_planning_data: { Args: Record<never, never>; Returns: undefined };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
