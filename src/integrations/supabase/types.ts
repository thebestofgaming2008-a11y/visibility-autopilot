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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audits: {
        Row: {
          created_at: string
          created_by: string | null
          error: string | null
          finished_at: string | null
          id: string
          site_id: string
          started_at: string | null
          status: string
          summary: Json
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          site_id: string
          started_at?: string | null
          status?: string
          summary?: Json
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          site_id?: string
          started_at?: string | null
          status?: string
          summary?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audits_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      change_events: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          detail: Json
          entity: string
          entity_id: string | null
          id: string
          workspace_id: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          detail?: Json
          entity: string
          entity_id?: string | null
          id?: string
          workspace_id: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          detail?: Json
          entity?: string
          entity_id?: string | null
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      change_requests: {
        Row: {
          approved_by: string | null
          created_at: string
          created_by: string | null
          id: string
          opportunity_id: string | null
          proposed_change: string
          requires_consent: boolean
          risk: string
          rollback_plan: string | null
          site_id: string
          status: string
          test_plan: string | null
          title: string
          workspace_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          opportunity_id?: string | null
          proposed_change: string
          requires_consent?: boolean
          risk?: string
          rollback_plan?: string | null
          site_id: string
          status?: string
          test_plan?: string | null
          title: string
          workspace_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          opportunity_id?: string | null
          proposed_change?: string
          requires_consent?: boolean
          risk?: string
          rollback_plan?: string | null
          site_id?: string
          status?: string
          test_plan?: string | null
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_requests_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_requests_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_sites: {
        Row: {
          created_at: string
          domain: string
          id: string
          notes: string | null
          site_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          notes?: string | null
          site_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          notes?: string | null
          site_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_sites_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_sites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_briefs: {
        Row: {
          ai_generated: boolean
          applicability: string | null
          created_at: string
          draft: string | null
          id: string
          language: string
          outline: string | null
          page_type: string
          search_intent: string | null
          site_id: string
          sources: Json
          status: string
          target_query: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ai_generated?: boolean
          applicability?: string | null
          created_at?: string
          draft?: string | null
          id?: string
          language?: string
          outline?: string | null
          page_type?: string
          search_intent?: string | null
          site_id: string
          sources?: Json
          status?: string
          target_query?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ai_generated?: boolean
          applicability?: string | null
          created_at?: string
          draft?: string | null
          id?: string
          language?: string
          outline?: string | null
          page_type?: string
          search_intent?: string | null
          site_id?: string
          sources?: Json
          status?: string
          target_query?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_briefs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_briefs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_pages: {
        Row: {
          audit_id: string
          bytes: number | null
          content_type: string | null
          duration_ms: number | null
          error: string | null
          fetched_at: string
          http_status: number | null
          id: string
          kind: string
          parsed: Json
          redirect_chain: Json
          url: string
          workspace_id: string
        }
        Insert: {
          audit_id: string
          bytes?: number | null
          content_type?: string | null
          duration_ms?: number | null
          error?: string | null
          fetched_at?: string
          http_status?: number | null
          id?: string
          kind?: string
          parsed?: Json
          redirect_chain?: Json
          url: string
          workspace_id: string
        }
        Update: {
          audit_id?: string
          bytes?: number | null
          content_type?: string | null
          duration_ms?: number | null
          error?: string | null
          fetched_at?: string
          http_status?: number | null
          id?: string
          kind?: string
          parsed?: Json
          redirect_chain?: Json
          url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crawl_pages_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_pages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          created_at: string
          finding_id: string | null
          http_status: number | null
          id: string
          observed_at: string
          snippet: string | null
          source: string
          url: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          finding_id?: string | null
          http_status?: number | null
          id?: string
          observed_at: string
          snippet?: string | null
          source?: string
          url: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          finding_id?: string | null
          http_status?: number | null
          id?: string
          observed_at?: string
          snippet?: string | null
          source?: string
          url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      findings: {
        Row: {
          audit_id: string
          category: string
          code: string
          confidence: string
          created_at: string
          detail: string | null
          id: string
          recommendation: string
          severity: string
          site_id: string
          title: string
          url: string | null
          workspace_id: string
        }
        Insert: {
          audit_id: string
          category: string
          code: string
          confidence: string
          created_at?: string
          detail?: string | null
          id?: string
          recommendation: string
          severity: string
          site_id: string
          title: string
          url?: string | null
          workspace_id: string
        }
        Update: {
          audit_id?: string
          category?: string
          code?: string
          confidence?: string
          created_at?: string
          detail?: string | null
          id?: string
          recommendation?: string
          severity?: string
          site_id?: string
          title?: string
          url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "findings_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          provider: string
          site_id: string | null
          status: string
          verified_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          provider: string
          site_id?: string | null
          status?: string
          verified_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          provider?: string
          site_id?: string | null
          status?: string
          verified_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      job_runs: {
        Row: {
          created_at: string
          created_by: string | null
          error: string | null
          finished_at: string | null
          id: string
          kind: string
          ref_id: string | null
          site_id: string | null
          started_at: string | null
          status: string
          trigger: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          kind: string
          ref_id?: string | null
          site_id?: string | null
          started_at?: string | null
          status?: string
          trigger?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          ref_id?: string | null
          site_id?: string | null
          started_at?: string | null
          status?: string
          trigger?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_runs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      keywords: {
        Row: {
          created_at: string
          id: string
          intent: string | null
          language: string
          notes: string | null
          site_id: string
          source: string
          term: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intent?: string | null
          language?: string
          notes?: string | null
          site_id: string
          source?: string
          term: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intent?: string | null
          language?: string
          notes?: string | null
          site_id?: string
          source?: string
          term?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "keywords_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keywords_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_snapshots: {
        Row: {
          captured_at: string
          id: string
          metric: string
          period_end: string | null
          period_start: string | null
          site_id: string
          source: string
          value: number | null
          workspace_id: string
        }
        Insert: {
          captured_at?: string
          id?: string
          metric: string
          period_end?: string | null
          period_start?: string | null
          site_id: string
          source: string
          value?: number | null
          workspace_id: string
        }
        Update: {
          captured_at?: string
          id?: string
          metric?: string
          period_end?: string | null
          period_start?: string | null
          site_id?: string
          source?: string
          value?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metrics_snapshots_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metrics_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          confidence: number
          created_at: string
          description: string | null
          effort: number
          finding_code: string | null
          finding_id: string | null
          id: string
          impact: number
          next_action: string | null
          owner: string
          risk: string
          site_id: string
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          description?: string | null
          effort?: number
          finding_code?: string | null
          finding_id?: string | null
          id?: string
          impact?: number
          next_action?: string | null
          owner?: string
          risk?: string
          site_id: string
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          description?: string | null
          effort?: number
          finding_code?: string | null
          finding_id?: string | null
          id?: string
          impact?: number
          next_action?: string | null
          owner?: string
          risk?: string
          site_id?: string
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      sites: {
        Row: {
          allow_location_pages: boolean
          business_facts: Json
          created_at: string
          display_name: string
          domain: string
          id: string
          languages: string[]
          ownership_verified: boolean
          regions: string[]
          service_radius_km: number | null
          source_repo: string | null
          updated_at: string
          workspace_id: string
          write_access_verified: boolean
        }
        Insert: {
          allow_location_pages?: boolean
          business_facts?: Json
          created_at?: string
          display_name: string
          domain: string
          id?: string
          languages?: string[]
          ownership_verified?: boolean
          regions?: string[]
          service_radius_km?: number | null
          source_repo?: string | null
          updated_at?: string
          workspace_id: string
          write_access_verified?: boolean
        }
        Update: {
          allow_location_pages?: boolean
          business_facts?: Json
          created_at?: string
          display_name?: string
          domain?: string
          id?: string
          languages?: string[]
          ownership_verified?: boolean
          regions?: string[]
          service_radius_km?: number | null
          source_repo?: string | null
          updated_at?: string
          workspace_id?: string
          write_access_verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "sites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee: string | null
          created_at: string
          due_date: string | null
          id: string
          opportunity_id: string | null
          status: string
          title: string
          workspace_id: string
        }
        Insert: {
          assignee?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          opportunity_id?: string | null
          status?: string
          title: string
          workspace_id: string
        }
        Update: {
          assignee?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          opportunity_id?: string | null
          status?: string
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          autopilot_mode: string
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          autopilot_mode?: string
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          autopilot_mode?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit: { Args: { _ws: string }; Returns: boolean }
      is_member: { Args: { _ws: string }; Returns: boolean }
      is_ws_admin: { Args: { _ws: string }; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
