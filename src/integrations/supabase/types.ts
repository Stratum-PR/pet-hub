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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          created_at: string
          staff_id: string | null
          id: string
          notes: string | null
          pet_id: string
          price: number
          scheduled_date: string
          service_type: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          staff_id?: string | null
          id?: string
          notes?: string | null
          pet_id: string
          price?: number
          scheduled_date: string
          service_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          staff_id?: string | null
          id?: string
          notes?: string | null
          pet_id?: string
          price?: number
          scheduled_date?: string
          service_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          created_at: string
          email: string
          id: string
          name: string
          notes: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          notes?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      feature_catalog: {
        Row: {
          created_at: string
          display_name: string
          feature_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          feature_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          feature_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      feature_rollout: {
        Row: {
          feature_key: string
          min_tier: string
          updated_at: string
        }
        Insert: {
          feature_key: string
          min_tier: string
          updated_at?: string
        }
        Update: {
          feature_key?: string
          min_tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_rollout_feature_key_fk"
            columns: ["feature_key"]
            isOneToOne: true
            referencedRelation: "feature_catalog"
            referencedColumns: ["feature_key"]
          },
        ]
      }
      feature_visibility_rules: {
        Row: {
          feature_key: string
          roles: string[]
          subscription_tiers: string[]
          updated_at: string
        }
        Insert: {
          feature_key: string
          roles?: string[]
          subscription_tiers?: string[]
          updated_at?: string
        }
        Update: {
          feature_key?: string
          roles?: string[]
          subscription_tiers?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_visibility_rules_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: true
            referencedRelation: "feature_catalog"
            referencedColumns: ["feature_key"]
          },
        ]
      }
      staff: {
        Row: {
          id: string
          business_id: string
          name: string
          first_name: string
          last_name: string
          job_title_id: string | null
          email: string
          phone: string
          pin: string
          hourly_rate: number
          role: string
          access_role: string
          status: string
          hire_date: string | null
          last_date: string | null
          birth_month: number | null
          birth_day: number | null
          birth_year: number | null
          pin_set_at: string | null
          pin_required: boolean | null
          user_id: string | null
          photo_url: string | null
          compensation_type: string | null
          commission_rate: number | null
          staff_address: string | null
          ssn: string | null
          bank_routing_number: string | null
          bank_account_type: string | null
          bank_account_number: string | null
          bank_name: string | null
          payment_notes: string | null
          offered_service_ids: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          first_name?: string
          last_name?: string
          job_title_id?: string | null
          email?: string
          phone: string
          pin: string
          hourly_rate?: number
          role?: string
          access_role?: string
          status?: string
          hire_date?: string | null
          last_date?: string | null
          birth_month?: number | null
          birth_day?: number | null
          birth_year?: number | null
          pin_set_at?: string | null
          pin_required?: boolean | null
          user_id?: string | null
          photo_url?: string | null
          compensation_type?: string | null
          commission_rate?: number | null
          staff_address?: string | null
          ssn?: string | null
          bank_routing_number?: string | null
          bank_account_type?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          payment_notes?: string | null
          offered_service_ids?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
          first_name?: string
          last_name?: string
          job_title_id?: string | null
          email?: string
          phone?: string
          pin?: string
          hourly_rate?: number
          role?: string
          access_role?: string
          status?: string
          hire_date?: string | null
          last_date?: string | null
          birth_month?: number | null
          birth_day?: number | null
          birth_year?: number | null
          pin_set_at?: string | null
          pin_required?: boolean | null
          user_id?: string | null
          photo_url?: string | null
          compensation_type?: string | null
          commission_rate?: number | null
          staff_address?: string | null
          ssn?: string | null
          bank_routing_number?: string | null
          bank_account_type?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          payment_notes?: string | null
          offered_service_ids?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_job_titles: {
        Row: {
          id: string
          business_id: string
          title: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          title: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          title?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_invites: {
        Row: {
          id: string
          business_id: string
          staff_id: string
          email: string
          token: string
          invited_by: string
          status: string
          created_at: string
          expires_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          business_id: string
          staff_id: string
          email: string
          token?: string
          invited_by: string
          status?: string
          created_at?: string
          expires_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          business_id?: string
          staff_id?: string
          email?: string
          token?: string
          invited_by?: string
          status?: string
          created_at?: string
          expires_at?: string
          accepted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_invites_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          age: number
          breed: string
          client_id: string
          created_at: string
          id: string
          last_grooming_date: string | null
          name: string
          notes: string | null
          species: string
          updated_at: string
          vaccination_status: string | null
          weight: number
        }
        Insert: {
          age: number
          breed: string
          client_id: string
          created_at?: string
          id?: string
          last_grooming_date?: string | null
          name: string
          notes?: string | null
          species: string
          updated_at?: string
          vaccination_status?: string | null
          weight: number
        }
        Update: {
          age?: number
          breed?: string
          client_id?: string
          created_at?: string
          id?: string
          last_grooming_date?: string | null
          name?: string
          notes?: string | null
          species?: string
          updated_at?: string
          vaccination_status?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "pets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_business_notes: {
        Row: {
          id: string
          client_id: string
          business_id: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          business_id: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          business_id?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      pet_business_notes: {
        Row: {
          id: string
          pet_id: string
          business_id: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pet_id: string
          business_id: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pet_id?: string
          business_id?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          name: string
          price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name: string
          price: number
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          price?: number
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          clock_in: string
          clock_out: string | null
          created_at: string
          lunch_deduction_hours: number
          staff_id: string
          id: string
          notes: string | null
        }
        Insert: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          lunch_deduction_hours?: number
          staff_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          lunch_deduction_hours?: number
          staff_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          id: string
          email: string
          source: string
          locale: string
          confirmed: boolean
          confirm_token: string
          signed_up_at: string
          confirmed_at: string | null
          referral_code: string | null
          referred_by: string | null
          referred_by_code: string | null
          utm_source: string | null
          utm_medium: string | null
          utm_campaign: string | null
          metadata: Json
          survey_token: string | null
          admin_notify_at: string | null
          admin_notify_sent_at: string | null
          signup_notify_deadline_at: string | null
          survey_skipped_at: string | null
        }
        Insert: {
          id?: string
          email: string
          source?: string
          locale?: string
          confirmed?: boolean
          confirm_token?: string
          signed_up_at?: string
          confirmed_at?: string | null
          referral_code?: string | null
          referred_by?: string | null
          referred_by_code?: string | null
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          metadata?: Json
          survey_token?: string | null
          admin_notify_at?: string | null
          admin_notify_sent_at?: string | null
          signup_notify_deadline_at?: string | null
          survey_skipped_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          source?: string
          locale?: string
          confirmed?: boolean
          confirm_token?: string
          signed_up_at?: string
          confirmed_at?: string | null
          referral_code?: string | null
          referred_by?: string | null
          referred_by_code?: string | null
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          metadata?: Json
          survey_token?: string | null
          admin_notify_at?: string | null
          admin_notify_sent_at?: string | null
          signup_notify_deadline_at?: string | null
          survey_skipped_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "waitlist"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_survey: {
        Row: {
          id: string
          waitlist_id: string
          business_name: string | null
          groomer_count: string | null
          current_tools: string | null
          tools_selected: Json
          tools_other: string | null
          biggest_pain: string | null
          wants_ath_movil: boolean | null
          wants_costo: boolean | null
          wants_nomina_pr: boolean | null
          wants_staff_management: boolean | null
          wants_spanish_ui: boolean | null
          wants_online_booking: boolean | null
          wants_charge_online: boolean | null
          wants_inventory: boolean | null
          wants_advanced_reports: boolean | null
          submitted_at: string
        }
        Insert: {
          id?: string
          waitlist_id: string
          business_name?: string | null
          groomer_count?: string | null
          current_tools?: string | null
          tools_selected?: Json
          tools_other?: string | null
          biggest_pain?: string | null
          wants_ath_movil?: boolean | null
          wants_costo?: boolean | null
          wants_nomina_pr?: boolean | null
          wants_staff_management?: boolean | null
          wants_spanish_ui?: boolean | null
          wants_online_booking?: boolean | null
          wants_charge_online?: boolean | null
          wants_inventory?: boolean | null
          wants_advanced_reports?: boolean | null
          submitted_at?: string
        }
        Update: {
          id?: string
          waitlist_id?: string
          business_name?: string | null
          groomer_count?: string | null
          current_tools?: string | null
          tools_selected?: Json
          tools_other?: string | null
          biggest_pain?: string | null
          wants_ath_movil?: boolean | null
          wants_costo?: boolean | null
          wants_nomina_pr?: boolean | null
          wants_staff_management?: boolean | null
          wants_spanish_ui?: boolean | null
          wants_online_booking?: boolean | null
          wants_charge_online?: boolean | null
          wants_inventory?: boolean | null
          wants_advanced_reports?: boolean | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_survey_waitlist_id_fkey"
            columns: ["waitlist_id"]
            isOneToOne: true
            referencedRelation: "waitlist"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      validate_staff_invite: {
        Args: {
          invite_token: string
        }
        Returns: {
          id: string
          email: string
          status: string
          expires_at: string
          business_id: string
          business_name: string
        }[]
      }
      get_employee_portal_settings: {
        Args: {
          p_business_id: string
        }
        Returns: Record<string, unknown> | null
      }
      sync_staff_job_titles_from_staff_roles: {
        Args: {
          p_business_id: string
        }
        Returns: undefined
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
  public: {
    Enums: {},
  },
} as const
