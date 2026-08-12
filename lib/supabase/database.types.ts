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
    PostgrestVersion: "14.15"
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
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json
          organization_id: string
          target_email: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          organization_id: string
          target_email?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          organization_id?: string
          target_email?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          id?: string
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
      job_comments: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          job_id: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          job_id: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          job_id?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_comments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      job_profile_matches: {
        Row: {
          ai_model_version: string
          created_at: string
          cv_id: string
          id: string
          job_id: string
          organization_id: string
          profile_id: string
          relevance_score: number
          updated_at: string
        }
        Insert: {
          ai_model_version: string
          created_at?: string
          cv_id: string
          id?: string
          job_id: string
          organization_id: string
          profile_id: string
          relevance_score: number
          updated_at?: string
        }
        Update: {
          ai_model_version?: string
          created_at?: string
          cv_id?: string
          id?: string
          job_id?: string
          organization_id?: string
          profile_id?: string
          relevance_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_profile_matches_cv_id_fkey"
            columns: ["cv_id"]
            isOneToOne: false
            referencedRelation: "profile_cvs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_profile_matches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_profile_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_profile_matches_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_profile_states: {
        Row: {
          created_at: string
          cv_id: string | null
          deleted_at: string | null
          dismissed_reason: string | null
          id: string
          job_id: string
          organization_id: string
          profile_id: string
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          cv_id?: string | null
          deleted_at?: string | null
          dismissed_reason?: string | null
          id?: string
          job_id: string
          organization_id: string
          profile_id: string
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          cv_id?: string | null
          deleted_at?: string | null
          dismissed_reason?: string | null
          id?: string
          job_id?: string
          organization_id?: string
          profile_id?: string
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_profile_states_cv_id_fkey"
            columns: ["cv_id"]
            isOneToOne: false
            referencedRelation: "profile_cvs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_profile_states_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_profile_states_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_profile_states_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_profile_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          apply_url: string
          company_location: string | null
          company_name: string
          created_at: string
          description: string | null
          external_job_id: string
          id: string
          is_globally_open: boolean | null
          is_remote: boolean | null
          job_posted_at: string | null
          organization_id: string
          parsed_data: Json | null
          possibly_closed: boolean
          possibly_closed_reason: string | null
          remote_allowed_region: string | null
          scraper_id: string
          title: string
        }
        Insert: {
          apply_url: string
          company_location?: string | null
          company_name: string
          created_at?: string
          description?: string | null
          external_job_id: string
          id?: string
          is_globally_open?: boolean | null
          is_remote?: boolean | null
          job_posted_at?: string | null
          organization_id: string
          parsed_data?: Json | null
          possibly_closed?: boolean
          possibly_closed_reason?: string | null
          remote_allowed_region?: string | null
          scraper_id: string
          title: string
        }
        Update: {
          apply_url?: string
          company_location?: string | null
          company_name?: string
          created_at?: string
          description?: string | null
          external_job_id?: string
          id?: string
          is_globally_open?: boolean | null
          is_remote?: boolean | null
          job_posted_at?: string | null
          organization_id?: string
          parsed_data?: Json | null
          possibly_closed?: boolean
          possibly_closed_reason?: string | null
          remote_allowed_region?: string | null
          scraper_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_scraper_id_fkey"
            columns: ["scraper_id"]
            isOneToOne: false
            referencedRelation: "scrapers"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          applied_at: string
          created_at: string
          deleted_at: string | null
          id: string
          job_id: string
          job_profile_state_id: string | null
          last_activity_at: string
          notes: string
          organization_id: string
          pipeline_stage_id: string
          profile_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          applied_at?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          job_id: string
          job_profile_state_id?: string | null
          last_activity_at?: string
          notes?: string
          organization_id: string
          pipeline_stage_id: string
          profile_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          applied_at?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          job_id?: string
          job_profile_state_id?: string | null
          last_activity_at?: string
          notes?: string
          organization_id?: string
          pipeline_stage_id?: string
          profile_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_job_profile_state_id_fkey"
            columns: ["job_profile_state_id"]
            isOneToOne: false
            referencedRelation: "job_profile_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          allowed_email_domain: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          allowed_email_domain?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          allowed_email_domain?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          created_at: string
          id: string
          name: string
          order_index: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_index: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_index?: number
        }
        Relationships: []
      }
      profile_cvs: {
        Row: {
          created_at: string
          deleted_at: string | null
          file_name: string
          file_size_bytes: number
          file_type: string
          id: string
          parse_error: string | null
          parse_model_version: string | null
          parse_schema_version: number | null
          parse_status: string
          parsed_at: string | null
          parsed_data: Json | null
          profile_id: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          file_name: string
          file_size_bytes: number
          file_type: string
          id?: string
          parse_error?: string | null
          parse_model_version?: string | null
          parse_schema_version?: number | null
          parse_status?: string
          parsed_at?: string | null
          parsed_data?: Json | null
          profile_id: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          file_name?: string
          file_size_bytes?: number
          file_type?: string
          id?: string
          parse_error?: string | null
          parse_model_version?: string | null
          parse_schema_version?: number | null
          parse_status?: string
          parsed_at?: string | null
          parsed_data?: Json | null
          profile_id?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_cvs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          location: string | null
          organization_id: string
          phone: string | null
          rate_currency: string
          rate_expectation: number | null
          rate_unit: string | null
          seniority_level_id: string | null
          summary: string | null
          updated_at: string
          user_id: string | null
          years_of_experience: number | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          location?: string | null
          organization_id: string
          phone?: string | null
          rate_currency?: string
          rate_expectation?: number | null
          rate_unit?: string | null
          seniority_level_id?: string | null
          summary?: string | null
          updated_at?: string
          user_id?: string | null
          years_of_experience?: number | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          location?: string | null
          organization_id?: string
          phone?: string | null
          rate_currency?: string
          rate_expectation?: number | null
          rate_unit?: string | null
          seniority_level_id?: string | null
          summary?: string | null
          updated_at?: string
          user_id?: string | null
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_seniority_level_id_fkey"
            columns: ["seniority_level_id"]
            isOneToOne: false
            referencedRelation: "seniority_level"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      scrapers: {
        Row: {
          base_url: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          base_url: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          base_url?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      seniority_level: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          organization_id: string
          role_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          organization_id: string
          role_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          role_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_org_id: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      is_admin_in: { Args: { p_org_id: string }; Returns: boolean }
      is_bd_manager: { Args: never; Returns: boolean }
      is_privileged_in: { Args: { p_org_id: string }; Returns: boolean }
    }
    Enums: {
      application_status: "suggested" | "dismissed" | "applied"
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
      application_status: ["suggested", "dismissed", "applied"],
    },
  },
} as const
