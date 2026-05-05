export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      issue_links: {
        Row: {
          created_at: string
          id: number
          link_type: string
          source_issue_id: string
          target_issue_id: string | null
          target_issue_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          link_type: string
          source_issue_id: string
          target_issue_id?: string | null
          target_issue_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          link_type?: string
          source_issue_id?: string
          target_issue_id?: string | null
          target_issue_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_links_source_issue_id_fkey"
            columns: ["source_issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_links_target_issue_id_fkey"
            columns: ["target_issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          assignee_account_id: string | null
          assignee_display_name: string | null
          created_at: string
          created_at_jira: string | null
          due_date: string | null
          id: string
          issue_type: string
          key: string
          parent_id: string | null
          priority: string | null
          project_id: string
          raw: Json | null
          start_date: string | null
          status_category: string
          status_name: string
          summary: string
          synced_at: string
          updated_at: string
          updated_at_jira: string | null
        }
        Insert: {
          assignee_account_id?: string | null
          assignee_display_name?: string | null
          created_at?: string
          created_at_jira?: string | null
          due_date?: string | null
          id: string
          issue_type: string
          key: string
          parent_id?: string | null
          priority?: string | null
          project_id: string
          raw?: Json | null
          start_date?: string | null
          status_category: string
          status_name: string
          summary: string
          synced_at?: string
          updated_at?: string
          updated_at_jira?: string | null
        }
        Update: {
          assignee_account_id?: string | null
          assignee_display_name?: string | null
          created_at?: string
          created_at_jira?: string | null
          due_date?: string | null
          id?: string
          issue_type?: string
          key?: string
          parent_id?: string | null
          priority?: string | null
          project_id?: string
          raw?: Json | null
          start_date?: string | null
          status_category?: string
          status_name?: string
          summary?: string
          synced_at?: string
          updated_at?: string
          updated_at_jira?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issues_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_dependencies: {
        Row: {
          commitment_status: string
          coordination_notes: string | null
          created_at: string
          created_by: string | null
          description: string | null
          expected_delivery_date: string | null
          id: string
          identifier: string
          narrative_id: string
          needed_by_date: string | null
          order_index: number
          provider_jira_issue_keys: string[]
          provider_pod: string | null
          provider_pod_project_key: string | null
          title: string
          updated_at: string
          updated_by: string | null
          workstream_id: string | null
        }
        Insert: {
          commitment_status?: string
          coordination_notes?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_delivery_date?: string | null
          id?: string
          identifier: string
          narrative_id: string
          needed_by_date?: string | null
          order_index: number
          provider_jira_issue_keys?: string[]
          provider_pod?: string | null
          provider_pod_project_key?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          workstream_id?: string | null
        }
        Update: {
          commitment_status?: string
          coordination_notes?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_delivery_date?: string | null
          id?: string
          identifier?: string
          narrative_id?: string
          needed_by_date?: string | null
          order_index?: number
          provider_jira_issue_keys?: string[]
          provider_pod?: string | null
          provider_pod_project_key?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          workstream_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "narrative_dependencies_narrative_id_fkey"
            columns: ["narrative_id"]
            isOneToOne: false
            referencedRelation: "project_narratives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_dependencies_workstream_id_fkey"
            columns: ["workstream_id"]
            isOneToOne: false
            referencedRelation: "narrative_workstreams"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_phases: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          name: string
          narrative_id: string
          objective: string | null
          order_index: number
          progress_percent: number | null
          rationale: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          narrative_id: string
          objective?: string | null
          order_index: number
          progress_percent?: number | null
          rationale?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          narrative_id?: string
          objective?: string | null
          order_index?: number
          progress_percent?: number | null
          rationale?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_phases_narrative_id_fkey"
            columns: ["narrative_id"]
            isOneToOne: false
            referencedRelation: "project_narratives"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_risks: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          identifier: string
          impacts: string[]
          mitigations: string[]
          narrative_id: string
          order_index: number
          related_dependency_ids: string[]
          severity: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          identifier: string
          impacts?: string[]
          mitigations?: string[]
          narrative_id: string
          order_index: number
          related_dependency_ids?: string[]
          severity?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          identifier?: string
          impacts?: string[]
          mitigations?: string[]
          narrative_id?: string
          order_index?: number
          related_dependency_ids?: string[]
          severity?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "narrative_risks_narrative_id_fkey"
            columns: ["narrative_id"]
            isOneToOne: false
            referencedRelation: "project_narratives"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_workstreams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          jira_issue_keys: string[]
          name: string
          narrative_id: string
          order_index: number
          phase_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          jira_issue_keys?: string[]
          name: string
          narrative_id: string
          order_index: number
          phase_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          jira_issue_keys?: string[]
          name?: string
          narrative_id?: string
          order_index?: number
          phase_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_workstream_phase_narrative"
            columns: ["phase_id", "narrative_id"]
            isOneToOne: false
            referencedRelation: "narrative_phases"
            referencedColumns: ["id", "narrative_id"]
          },
          {
            foreignKeyName: "narrative_workstreams_narrative_id_fkey"
            columns: ["narrative_id"]
            isOneToOne: false
            referencedRelation: "project_narratives"
            referencedColumns: ["id"]
          },
        ]
      }
      project_narratives: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          next_dependency_id: number
          next_risk_id: number
          overview: string | null
          project_id: string
          published: boolean
          risks_section_subtitle: string | null
          status_summary: string | null
          subtitle: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          next_dependency_id?: number
          next_risk_id?: number
          overview?: string | null
          project_id: string
          published?: boolean
          risks_section_subtitle?: string | null
          status_summary?: string | null
          subtitle?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          next_dependency_id?: number
          next_risk_id?: number
          overview?: string | null
          project_id?: string
          published?: boolean
          risks_section_subtitle?: string | null
          status_summary?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_narratives_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_narratives_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          id: string
          key: string
          last_synced_at: string | null
          lead_account_id: string | null
          lead_display_name: string | null
          name: string
          raw: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          key: string
          last_synced_at?: string | null
          lead_account_id?: string | null
          lead_display_name?: string | null
          name: string
          raw?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          last_synced_at?: string | null
          lead_account_id?: string | null
          lead_display_name?: string | null
          name?: string
          raw?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: number
          issues_created: number
          issues_deleted: number
          issues_updated: number
          jql_used: string | null
          links_skipped: number
          project_key: string | null
          started_at: string
          status: string
          sync_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: number
          issues_created?: number
          issues_deleted?: number
          issues_updated?: number
          jql_used?: string | null
          links_skipped?: number
          project_key?: string | null
          started_at?: string
          status: string
          sync_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: number
          issues_created?: number
          issues_deleted?: number
          issues_updated?: number
          jql_used?: string | null
          links_skipped?: number
          project_key?: string | null
          started_at?: string
          status?: string
          sync_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          jira_account_id: string | null
          jira_verified_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          jira_account_id?: string | null
          jira_verified_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          jira_account_id?: string | null
          jira_verified_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      project_stats: {
        Row: {
          done_issues: number | null
          id: string | null
          key: string | null
          last_synced_at: string | null
          lead_display_name: string | null
          name: string | null
          narratives_count: number | null
          total_issues: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      claim_next_dependency_identifier: {
        Args: { p_narrative_id: string }
        Returns: string
      }
      claim_next_risk_identifier: {
        Args: { p_narrative_id: string }
        Returns: string
      }
      project_dashboard: {
        Args: { p_project_key: string }
        Returns: {
          blocked_count: number
          done_count: number
          in_progress_count: number
          last_synced_at: string
          lead_display_name: string
          overdue_count: number
          project_id: string
          project_key: string
          project_name: string
          todo_count: number
          total: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
