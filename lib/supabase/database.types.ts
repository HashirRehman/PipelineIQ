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
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      cron_run_locks: {
        Row: {
          id: string
          is_running: boolean
          last_completed_at: string | null
          started_at: string | null
          updated_at: string
        }
        Insert: {
          id: string
          is_running?: boolean
          last_completed_at?: string | null
          started_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          is_running?: boolean
          last_completed_at?: string | null
          started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      engineer_bd_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          bd_user_id: string
          engineer_id: string
          id: string
          unassigned_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          bd_user_id: string
          engineer_id: string
          id?: string
          unassigned_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          bd_user_id?: string
          engineer_id?: string
          id?: string
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engineer_bd_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engineer_bd_assignments_bd_user_id_fkey"
            columns: ["bd_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engineer_bd_assignments_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
        ]
      }
      engineer_cvs: {
        Row: {
          created_at: string
          engineer_id: string
          file_name: string
          file_size_bytes: number
          id: string
          is_current: boolean
          label: string
          mime_type: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          engineer_id: string
          file_name: string
          file_size_bytes: number
          id?: string
          is_current?: boolean
          label: string
          mime_type: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          engineer_id?: string
          file_name?: string
          file_size_bytes?: number
          id?: string
          is_current?: boolean
          label?: string
          mime_type?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "engineer_cvs_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engineer_cvs_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engineer_skills: {
        Row: {
          engineer_id: string
          proficiency: number | null
          skill_id: string
        }
        Insert: {
          engineer_id: string
          proficiency?: number | null
          skill_id: string
        }
        Update: {
          engineer_id?: string
          proficiency?: number | null
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engineer_skills_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engineer_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      engineers: {
        Row: {
          created_at: string
          created_by: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          location: string | null
          phone: string | null
          rate_currency: string
          rate_expectation: number | null
          seniority_level_id: string
          summary: string | null
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          location?: string | null
          phone?: string | null
          rate_currency?: string
          rate_expectation?: number | null
          seniority_level_id: string
          summary?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          location?: string | null
          phone?: string | null
          rate_currency?: string
          rate_expectation?: number | null
          seniority_level_id?: string
          summary?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "engineers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engineers_seniority_level_id_fkey"
            columns: ["seniority_level_id"]
            isOneToOne: false
            referencedRelation: "seniority_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      job_engineer_matches: {
        Row: {
          ai_model_version: string
          created_at: string
          dismissed_reason: string | null
          engineer_id: string
          id: string
          job_id: string
          recommended_cv_id: string | null
          relevance_score: number
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
        }
        Insert: {
          ai_model_version: string
          created_at?: string
          dismissed_reason?: string | null
          engineer_id: string
          id?: string
          job_id: string
          recommended_cv_id?: string | null
          relevance_score: number
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
        }
        Update: {
          ai_model_version?: string
          created_at?: string
          dismissed_reason?: string | null
          engineer_id?: string
          id?: string
          job_id?: string
          recommended_cv_id?: string | null
          relevance_score?: number
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_engineer_matches_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_engineer_matches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_engineer_matches_recommended_cv_id_fkey"
            columns: ["recommended_cv_id"]
            isOneToOne: false
            referencedRelation: "engineer_cvs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_sources: {
        Row: {
          base_url: string | null
          config: Json
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          base_url?: string | null
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          base_url?: string | null
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          apply_url: string
          company_name: string
          created_at: string
          dedup_hash: string | null
          description: string | null
          discovered_at: string
          external_job_id: string
          id: string
          is_globally_open: boolean | null
          is_remote: boolean | null
          job_source_id: string
          location: string | null
          possibly_closed: boolean | null
          possibly_closed_reason: string | null
          posted_at: string | null
          remote_region: string | null
          title: string
        }
        Insert: {
          apply_url: string
          company_name: string
          created_at?: string
          dedup_hash?: string | null
          description?: string | null
          discovered_at?: string
          external_job_id: string
          id?: string
          is_globally_open?: boolean | null
          is_remote?: boolean | null
          job_source_id: string
          location?: string | null
          possibly_closed?: boolean | null
          possibly_closed_reason?: string | null
          posted_at?: string | null
          remote_region?: string | null
          title: string
        }
        Update: {
          apply_url?: string
          company_name?: string
          created_at?: string
          dedup_hash?: string | null
          description?: string | null
          discovered_at?: string
          external_job_id?: string
          id?: string
          is_globally_open?: boolean | null
          is_remote?: boolean | null
          job_source_id?: string
          location?: string | null
          possibly_closed?: boolean | null
          possibly_closed_reason?: string | null
          posted_at?: string | null
          remote_region?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_job_source_id_fkey"
            columns: ["job_source_id"]
            isOneToOne: false
            referencedRelation: "job_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_event_types: {
        Row: {
          code: string
          created_at: string
          id: string
          label: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          label: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          label?: string
        }
        Relationships: []
      }
      lead_events: {
        Row: {
          ai_summary: string | null
          created_at: string
          created_by: string
          event_type_id: string
          id: string
          lead_id: string
          note: string | null
          occurred_at: string
          stage_id: string | null
        }
        Insert: {
          ai_summary?: string | null
          created_at?: string
          created_by: string
          event_type_id: string
          id?: string
          lead_id: string
          note?: string | null
          occurred_at?: string
          stage_id?: string | null
        }
        Update: {
          ai_summary?: string | null
          created_at?: string
          created_by?: string
          event_type_id?: string
          id?: string
          lead_id?: string
          note?: string | null
          occurred_at?: string
          stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "lead_event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          applied_at: string
          bd_user_id: string
          created_at: string
          current_stage_id: string
          engineer_id: string
          id: string
          job_engineer_match_id: string
          job_id: string
          last_activity_at: string
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          applied_at?: string
          bd_user_id: string
          created_at?: string
          current_stage_id: string
          engineer_id: string
          id?: string
          job_engineer_match_id: string
          job_id: string
          last_activity_at?: string
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          applied_at?: string
          bd_user_id?: string
          created_at?: string
          current_stage_id?: string
          engineer_id?: string
          id?: string
          job_engineer_match_id?: string
          job_id?: string
          last_activity_at?: string
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_bd_user_id_fkey"
            columns: ["bd_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_job_engineer_match_id_fkey"
            columns: ["job_engineer_match_id"]
            isOneToOne: false
            referencedRelation: "job_engineer_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      login_history: {
        Row: {
          id: string
          ip_address: unknown
          logged_in_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          ip_address?: unknown
          logged_in_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          ip_address?: unknown
          logged_in_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_terminal: boolean
          name: string
          order_index: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_terminal?: boolean
          name: string
          order_index: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_terminal?: boolean
          name?: string
          order_index?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      seniority_levels: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          rank: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          rank: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          rank?: number
        }
        Relationships: []
      }
      skills: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assigned_engineer_ids: { Args: never; Returns: string[] }
      create_lead_from_match: {
        Args: { p_bd_user_id: string; p_match_id: string }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      owned_lead_engineer_ids: { Args: never; Returns: string[] }
      owned_lead_job_ids: { Args: never; Returns: string[] }
      reassign_engineer_bd: {
        Args: {
          p_engineer_id: string
          p_new_bd_user_id: string
          p_old_bd_user_id: string
        }
        Returns: undefined
      }
      upsert_job_engineer_match: {
        Args: {
          p_ai_model_version: string
          p_engineer_id: string
          p_job_id: string
          p_relevance_score: number
        }
        Returns: undefined
      }
      withdraw_lead: {
        Args: { p_lead_id: string; p_reason: string }
        Returns: undefined
      }
    }
    Enums: {
      lead_status: "active" | "withdrawn" | "closed"
      match_status: "suggested" | "dismissed" | "applied"
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
    Enums: {
      lead_status: ["active", "withdrawn", "closed"],
      match_status: ["suggested", "dismissed", "applied"],
    },
  },
} as const
