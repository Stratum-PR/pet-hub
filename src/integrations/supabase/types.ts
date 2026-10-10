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
  public: {
    Tables: {
      admin_impersonation_tokens: {
        Row: {
          admin_id: string
          business_id: string
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          admin_id: string
          business_id: string
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          admin_id?: string
          business_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_impersonation_tokens_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_impersonation_tokens_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_notifications: {
        Row: {
          appointment_id: string
          business_id: string
          channel: string
          created_at: string
          detail: string | null
          id: string
          kind: string
          status: string
        }
        Insert: {
          appointment_id: string
          business_id: string
          channel: string
          created_at?: string
          detail?: string | null
          id?: string
          kind: string
          status: string
        }
        Update: {
          appointment_id?: string
          business_id?: string
          channel?: string
          created_at?: string
          detail?: string | null
          id?: string
          kind?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string | null
          billed: boolean
          booked_by_staff_id: string | null
          booking_source: string
          business_id: string | null
          client_id: string | null
          created_at: string | null
          customer_id: string | null
          decided_at: string | null
          decided_by_profile_id: string | null
          decided_by_staff_id: string | null
          decision_note: string | null
          end_time: string | null
          id: string
          notes: string | null
          pet_id: string | null
          price: number | null
          reminder_sent_at: string | null
          scheduled_date: string | null
          service_id: string | null
          service_ids: string[]
          service_type: string | null
          staff_id: string | null
          start_time: string | null
          status: string | null
          total_price: number | null
          transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          appointment_date?: string | null
          billed?: boolean
          booked_by_staff_id?: string | null
          booking_source?: string
          business_id?: string | null
          client_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          decided_at?: string | null
          decided_by_profile_id?: string | null
          decided_by_staff_id?: string | null
          decision_note?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          pet_id?: string | null
          price?: number | null
          reminder_sent_at?: string | null
          scheduled_date?: string | null
          service_id?: string | null
          service_ids?: string[]
          service_type?: string | null
          staff_id?: string | null
          start_time?: string | null
          status?: string | null
          total_price?: number | null
          transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          appointment_date?: string | null
          billed?: boolean
          booked_by_staff_id?: string | null
          booking_source?: string
          business_id?: string | null
          client_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          decided_at?: string | null
          decided_by_profile_id?: string | null
          decided_by_staff_id?: string | null
          decision_note?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          pet_id?: string | null
          price?: number | null
          reminder_sent_at?: string | null
          scheduled_date?: string | null
          service_id?: string | null
          service_ids?: string[]
          service_type?: string | null
          staff_id?: string | null
          start_time?: string | null
          status?: string | null
          total_price?: number | null
          transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_booked_by_staff_id_fkey"
            columns: ["booked_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_decided_by_profile_id_fkey"
            columns: ["decided_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_decided_by_staff_id_fkey"
            columns: ["decided_by_staff_id"]
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
          {
            foreignKeyName: "appointments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      breeds: {
        Row: {
          created_at: string | null
          id: string
          name: string
          species: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          species: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          species?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      business_client_links: {
        Row: {
          approved_at: string
          approved_by: string | null
          business_id: string
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string
          approved_by?: string | null
          business_id: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string
          approved_by?: string | null
          business_id?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_client_links_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_slug_aliases: {
        Row: {
          business_id: string
          created_at: string
          old_slug: string
        }
        Insert: {
          business_id: string
          created_at?: string
          old_slug: string
        }
        Update: {
          business_id?: string
          created_at?: string
          old_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_slug_aliases_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string
          enable_employee_clockin: boolean
          geofencing_enabled: boolean | null
          geofencing_latitude: number | null
          geofencing_location_name: string | null
          geofencing_longitude: number | null
          geofencing_radius_meters: number | null
          id: string
          kiosk_manager_pin: string | null
          logo_url: string | null
          maps_embed_url: string | null
          name: string
          onboarding_completed: boolean
          owner_id: string | null
          phone: string | null
          qr_code: string | null
          qr_generated_at: string | null
          short_code: string
          slug: string | null
          state: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_ends_at: string | null
          subscription_status: string
          subscription_tier: string
          trial_ends_at: string | null
          updated_at: string
          website: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email: string
          enable_employee_clockin?: boolean
          geofencing_enabled?: boolean | null
          geofencing_latitude?: number | null
          geofencing_location_name?: string | null
          geofencing_longitude?: number | null
          geofencing_radius_meters?: number | null
          id?: string
          kiosk_manager_pin?: string | null
          logo_url?: string | null
          maps_embed_url?: string | null
          name: string
          onboarding_completed?: boolean
          owner_id?: string | null
          phone?: string | null
          qr_code?: string | null
          qr_generated_at?: string | null
          short_code: string
          slug?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_ends_at?: string | null
          subscription_status?: string
          subscription_tier: string
          trial_ends_at?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string
          enable_employee_clockin?: boolean
          geofencing_enabled?: boolean | null
          geofencing_latitude?: number | null
          geofencing_location_name?: string | null
          geofencing_longitude?: number | null
          geofencing_radius_meters?: number | null
          id?: string
          kiosk_manager_pin?: string | null
          logo_url?: string | null
          maps_embed_url?: string | null
          name?: string
          onboarding_completed?: boolean
          owner_id?: string | null
          phone?: string | null
          qr_code?: string | null
          qr_generated_at?: string | null
          short_code?: string
          slug?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_ends_at?: string | null
          subscription_status?: string
          subscription_tier?: string
          trial_ends_at?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      client_business_notes: {
        Row: {
          business_id: string
          client_id: string
          created_at: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_business_notes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_business_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_payment_methods: {
        Row: {
          brand: string | null
          created_at: string
          exp_month: number | null
          exp_year: number | null
          external_id: string | null
          id: string
          is_default: boolean
          last4: string | null
          profile_id: string
          provider: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          external_id?: string | null
          id?: string
          is_default?: boolean
          last4?: string | null
          profile_id: string
          provider?: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          external_id?: string | null
          id?: string
          is_default?: boolean
          last4?: string | null
          profile_id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_payment_methods_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          business_id: string | null
          city: string | null
          contact_preference: string
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          marketing_email_opt_in: boolean
          marketing_sms_opt_in: boolean
          merged_into_client_id: string | null
          notes: string | null
          phone: string | null
          profile_id: string | null
          state: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          business_id?: string | null
          city?: string | null
          contact_preference?: string
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          marketing_email_opt_in?: boolean
          marketing_sms_opt_in?: boolean
          merged_into_client_id?: string | null
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          state?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          business_id?: string | null
          city?: string | null
          contact_preference?: string
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          marketing_email_opt_in?: boolean
          marketing_sms_opt_in?: boolean
          merged_into_client_id?: string | null
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          state?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_merged_into_client_id_fkey"
            columns: ["merged_into_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cookie_consents: {
        Row: {
          analytics: boolean
          anonymous_id: string
          created_at: string
          id: string
          locale: string | null
          marketing: boolean
          policy_version: string
          preferences: boolean
          user_id: string | null
        }
        Insert: {
          analytics?: boolean
          anonymous_id: string
          created_at?: string
          id?: string
          locale?: string | null
          marketing?: boolean
          policy_version: string
          preferences?: boolean
          user_id?: string | null
        }
        Update: {
          analytics?: boolean
          anonymous_id?: string
          created_at?: string
          id?: string
          locale?: string | null
          marketing?: boolean
          policy_version?: string
          preferences?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      employee_invitations: {
        Row: {
          accepted_at: string | null
          business_id: string
          created_at: string
          created_by: string | null
          email: string
          employee_id: string
          expires_at: string
          id: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          business_id: string
          created_at?: string
          created_by?: string | null
          email: string
          employee_id: string
          expires_at: string
          id?: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          business_id?: string
          created_at?: string
          created_by?: string | null
          email?: string
          employee_id?: string
          expires_at?: string
          id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_invitations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_invitations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
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
      guest_bookings: {
        Row: {
          appointment_date: string | null
          business_id: string | null
          created_at: string
          guest_email: string | null
          id: number
        }
        Insert: {
          appointment_date?: string | null
          business_id?: string | null
          created_at?: string
          guest_email?: string | null
          id?: number
        }
        Update: {
          appointment_date?: string | null
          business_id?: string | null
          created_at?: string
          guest_email?: string | null
          id?: number
        }
        Relationships: []
      }
      inventory: {
        Row: {
          barcode: string | null
          brand: string | null
          business_id: string
          category: string | null
          cost_price: number | null
          created_at: string | null
          custom_fields: Json | null
          description: string | null
          folder_id: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          photo_url: string | null
          product_name: string
          quantity_on_hand: number | null
          reorder_level: number | null
          reorder_quantity: number | null
          retail_price: number
          sale_price: number | null
          sku: string | null
          supplier: string | null
          target_species: string | null
          unit_of_measure: string | null
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          business_id: string
          category?: string | null
          cost_price?: number | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          folder_id?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          photo_url?: string | null
          product_name: string
          quantity_on_hand?: number | null
          reorder_level?: number | null
          reorder_quantity?: number | null
          retail_price: number
          sale_price?: number | null
          sku?: string | null
          supplier?: string | null
          target_species?: string | null
          unit_of_measure?: string | null
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          business_id?: string
          category?: string | null
          cost_price?: number | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          folder_id?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          photo_url?: string | null
          product_name?: string
          quantity_on_hand?: number | null
          reorder_level?: number | null
          reorder_quantity?: number | null
          retail_price?: number
          sale_price?: number | null
          sku?: string | null
          supplier?: string | null
          target_species?: string | null
          unit_of_measure?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "inventory_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_folders: {
        Row: {
          business_id: string
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_folders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "inventory_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock_movements: {
        Row: {
          business_id: string
          created_at: string
          id: string
          movement_type: string
          notes: string | null
          product_id: string
          quantity: number
          supplier: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          movement_type: string
          notes?: string | null
          product_id: string
          quantity: number
          supplier?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          movement_type?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      nav_order: {
        Row: {
          id: string
          order_json: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          order_json?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          order_json?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          appointment_id: string | null
          business_id: string
          created_at: string
          id: string
          message: string
          metadata: Json
          notification_type: string | null
          pet_id: string | null
          product_id: string | null
          read: boolean
          service_id: string | null
          staff_id: string | null
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          business_id: string
          created_at?: string
          id?: string
          message: string
          metadata?: Json
          notification_type?: string | null
          pet_id?: string | null
          product_id?: string | null
          read?: boolean
          service_id?: string | null
          staff_id?: string | null
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          business_id?: string
          created_at?: string
          id?: string
          message?: string
          metadata?: Json
          notification_type?: string | null
          pet_id?: string | null
          product_id?: string | null
          read?: boolean
          service_id?: string | null
          staff_id?: string | null
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_business_notes: {
        Row: {
          business_id: string
          created_at: string
          id: string
          notes: string | null
          pet_id: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          notes?: string | null
          pet_id: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          pet_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_business_notes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_business_notes_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          birth_month: number | null
          birth_year: number | null
          breed: string | null
          breed_id: string | null
          business_id: string | null
          client_id: string
          created_at: string | null
          id: string
          last_grooming_date: string | null
          last_vaccination_date: string | null
          name: string | null
          notes: string | null
          photo_url: string | null
          special_instructions: string | null
          species: string | null
          updated_at: string | null
          vaccination_status: string | null
          weight: number | null
        }
        Insert: {
          birth_month?: number | null
          birth_year?: number | null
          breed?: string | null
          breed_id?: string | null
          business_id?: string | null
          client_id: string
          created_at?: string | null
          id?: string
          last_grooming_date?: string | null
          last_vaccination_date?: string | null
          name?: string | null
          notes?: string | null
          photo_url?: string | null
          special_instructions?: string | null
          species?: string | null
          updated_at?: string | null
          vaccination_status?: string | null
          weight?: number | null
        }
        Update: {
          birth_month?: number | null
          birth_year?: number | null
          breed?: string | null
          breed_id?: string | null
          business_id?: string | null
          client_id?: string
          created_at?: string | null
          id?: string
          last_grooming_date?: string | null
          last_vaccination_date?: string | null
          name?: string | null
          notes?: string | null
          photo_url?: string | null
          special_instructions?: string | null
          species?: string | null
          updated_at?: string | null
          vaccination_status?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pets_breed_id_fkey"
            columns: ["breed_id"]
            isOneToOne: false
            referencedRelation: "breeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          business_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean | null
          is_super_admin: boolean
          phone: string | null
          prefer_admin_dashboard_on_login: boolean
          role: string | null
          staff_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          business_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean | null
          is_super_admin?: boolean
          phone?: string | null
          prefer_admin_dashboard_on_login?: boolean
          role?: string | null
          staff_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          business_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          is_super_admin?: boolean
          phone?: string | null
          prefer_admin_dashboard_on_login?: boolean
          role?: string | null
          staff_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_employee_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_settings: {
        Row: {
          business_id: string
          created_at: string | null
          footer_text: string | null
          header_text: string | null
          id: string
          logo_url: string | null
          receipt_location: string | null
          receipt_phone: string | null
          return_policy: string | null
          tagline: string | null
          thank_you_message: string | null
          updated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          footer_text?: string | null
          header_text?: string | null
          id?: string
          logo_url?: string | null
          receipt_location?: string | null
          receipt_phone?: string | null
          return_policy?: string | null
          tagline?: string | null
          thank_you_message?: string | null
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          footer_text?: string | null
          header_text?: string | null
          id?: string
          logo_url?: string | null
          receipt_location?: string | null
          receipt_phone?: string | null
          return_policy?: string | null
          tagline?: string | null
          thank_you_message?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          business_id: string
          color: string | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean | null
          name: string | null
          price: number | null
        }
        Insert: {
          business_id: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          price?: number | null
        }
        Update: {
          business_id?: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          business_branding_layout: Json | null
          business_hours: string | null
          business_icon_url_dark: string | null
          business_icon_url_light: string | null
          business_id: string
          business_logo_url: string | null
          business_logo_url_dark: string | null
          business_logo_url_light: string | null
          business_name: string | null
          created_at: string
          default_low_stock_threshold: string | null
          kiosk_warn_off_schedule: string
          navbar_logo_mode: string | null
          navbar_logo_size_px: number | null
          notify_appointment_unbilled: string | null
          notify_birthdays: string | null
          notify_general: string | null
          notify_inventory_low_stock: string | null
          notify_payment_overdue: string | null
          pay_schedule_anchor_date: string | null
          pay_schedule_cadence_weeks: string | null
          pay_schedule_custom_end: string | null
          pay_schedule_custom_start: string | null
          pay_schedule_mode: string | null
          primary_color: string | null
          secondary_color: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          business_branding_layout?: Json | null
          business_hours?: string | null
          business_icon_url_dark?: string | null
          business_icon_url_light?: string | null
          business_id: string
          business_logo_url?: string | null
          business_logo_url_dark?: string | null
          business_logo_url_light?: string | null
          business_name?: string | null
          created_at?: string
          default_low_stock_threshold?: string | null
          kiosk_warn_off_schedule?: string
          navbar_logo_mode?: string | null
          navbar_logo_size_px?: number | null
          notify_appointment_unbilled?: string | null
          notify_birthdays?: string | null
          notify_general?: string | null
          notify_inventory_low_stock?: string | null
          notify_payment_overdue?: string | null
          pay_schedule_anchor_date?: string | null
          pay_schedule_cadence_weeks?: string | null
          pay_schedule_custom_end?: string | null
          pay_schedule_custom_start?: string | null
          pay_schedule_mode?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          business_branding_layout?: Json | null
          business_hours?: string | null
          business_icon_url_dark?: string | null
          business_icon_url_light?: string | null
          business_id?: string
          business_logo_url?: string | null
          business_logo_url_dark?: string | null
          business_logo_url_light?: string | null
          business_name?: string | null
          created_at?: string
          default_low_stock_threshold?: string | null
          kiosk_warn_off_schedule?: string
          navbar_logo_mode?: string | null
          navbar_logo_size_px?: number | null
          notify_appointment_unbilled?: string | null
          notify_birthdays?: string | null
          notify_general?: string | null
          notify_inventory_low_stock?: string | null
          notify_payment_overdue?: string | null
          pay_schedule_anchor_date?: string | null
          pay_schedule_cadence_weeks?: string | null
          pay_schedule_custom_end?: string | null
          pay_schedule_custom_start?: string | null
          pay_schedule_mode?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          access_role: string
          auth_user_id: string | null
          bank_account_number: string | null
          bank_account_type: string | null
          bank_name: string | null
          bank_routing_number: string | null
          birth_day: number | null
          birth_month: number | null
          birth_year: number | null
          business_id: string | null
          commission_rate: number | null
          compensation_type: string
          created_at: string
          email: string
          first_name: string
          hourly_rate: number
          id: string
          invite_status: string
          job_title_id: string | null
          last_name: string
          name: string
          offered_service_ids: string[]
          payment_method: string | null
          payment_notes: string | null
          phone: string
          photo_url: string | null
          pin: string
          pin_required: boolean | null
          pin_set_at: string | null
          role: string
          ssn: string | null
          staff_address: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_role?: string
          auth_user_id?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_name?: string | null
          bank_routing_number?: string | null
          birth_day?: number | null
          birth_month?: number | null
          birth_year?: number | null
          business_id?: string | null
          commission_rate?: number | null
          compensation_type?: string
          created_at?: string
          email: string
          first_name: string
          hourly_rate?: number
          id?: string
          invite_status?: string
          job_title_id?: string | null
          last_name: string
          name: string
          offered_service_ids?: string[]
          payment_method?: string | null
          payment_notes?: string | null
          phone: string
          photo_url?: string | null
          pin: string
          pin_required?: boolean | null
          pin_set_at?: string | null
          role?: string
          ssn?: string | null
          staff_address?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_role?: string
          auth_user_id?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_name?: string | null
          bank_routing_number?: string | null
          birth_day?: number | null
          birth_month?: number | null
          birth_year?: number | null
          business_id?: string | null
          commission_rate?: number | null
          compensation_type?: string
          created_at?: string
          email?: string
          first_name?: string
          hourly_rate?: number
          id?: string
          invite_status?: string
          job_title_id?: string | null
          last_name?: string
          name?: string
          offered_service_ids?: string[]
          payment_method?: string | null
          payment_notes?: string | null
          phone?: string
          photo_url?: string | null
          pin?: string
          pin_required?: boolean | null
          pin_set_at?: string | null
          role?: string
          ssn?: string | null
          staff_address?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_job_title_id_fkey"
            columns: ["job_title_id"]
            isOneToOne: false
            referencedRelation: "staff_job_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invites: {
        Row: {
          accepted_at: string | null
          business_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          staff_id: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          business_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          staff_id: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          business_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          staff_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_invites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invites_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_job_titles: {
        Row: {
          business_id: string
          created_at: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_job_titles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_service_rates: {
        Row: {
          business_id: string
          created_at: string
          duration_minutes: number | null
          id: string
          price: number | null
          service_id: string
          staff_id: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          price?: number | null
          service_id: string
          staff_id: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          price?: number | null
          service_id?: string
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_service_rates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_service_rates_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_service_rates_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_shift_change_requests: {
        Row: {
          business_id: string
          created_at: string
          id: string
          proposed_end_time: string | null
          proposed_start_time: string | null
          reason: string
          request_kind: string
          requested_by: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          staff_id: string
          staff_shift_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          proposed_end_time?: string | null
          proposed_start_time?: string | null
          reason?: string
          request_kind: string
          requested_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_id: string
          staff_shift_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          proposed_end_time?: string | null
          proposed_start_time?: string | null
          reason?: string
          request_kind?: string
          requested_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_id?: string
          staff_shift_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_shift_change_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_shift_change_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_shift_change_requests_staff_shift_id_fkey"
            columns: ["staff_shift_id"]
            isOneToOne: false
            referencedRelation: "staff_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_shifts: {
        Row: {
          business_id: string
          created_at: string
          end_time: string
          id: string
          notes: string | null
          staff_id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          end_time: string
          id?: string
          notes?: string | null
          staff_id: string
          start_time: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          end_time?: string
          id?: string
          notes?: string | null
          staff_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_shifts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shifts_employee_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          business_id: string | null
          created_at: string
          id: number
          profile_id: string | null
          subscription_status: string | null
          subscription_tier: string | null
          updated_at: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          id?: number
          profile_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          id?: number
          profile_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      support_impersonation_audit: {
        Row: {
          admin_id: string
          business_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          target_user_id: string
          user_agent: string | null
        }
        Insert: {
          admin_id: string
          business_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          target_user_id: string
          user_agent?: string | null
        }
        Update: {
          admin_id?: string
          business_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          target_user_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_impersonation_audit_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_settings: {
        Row: {
          applies_to: string
          business_id: string
          created_at: string | null
          enabled: boolean
          id: string
          label: string
          rate: number
          region: string | null
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          applies_to?: string
          business_id: string
          created_at?: string | null
          enabled?: boolean
          id?: string
          label: string
          rate: number
          region?: string | null
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          applies_to?: string
          business_id?: string
          created_at?: string | null
          enabled?: boolean
          id?: string
          label?: string
          rate?: number
          region?: string | null
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          business_id: string | null
          clock_in: string | null
          clock_out: string | null
          created_at: string | null
          edit_request_id: string | null
          id: string
          is_off_schedule: boolean | null
          location_latitude: number | null
          location_longitude: number | null
          location_name: string | null
          lunch_deduction_hours: number
          notes: string | null
          rounded_clock_in: string | null
          rounded_clock_out: string | null
          staff_id: string | null
          status: string | null
        }
        Insert: {
          business_id?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string | null
          edit_request_id?: string | null
          id?: string
          is_off_schedule?: boolean | null
          location_latitude?: number | null
          location_longitude?: number | null
          location_name?: string | null
          lunch_deduction_hours?: number
          notes?: string | null
          rounded_clock_in?: string | null
          rounded_clock_out?: string | null
          staff_id?: string | null
          status?: string | null
        }
        Update: {
          business_id?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string | null
          edit_request_id?: string | null
          id?: string
          is_off_schedule?: boolean | null
          location_latitude?: number | null
          location_longitude?: number | null
          location_name?: string | null
          lunch_deduction_hours?: number
          notes?: string | null
          rounded_clock_in?: string | null
          rounded_clock_out?: string | null
          staff_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      time_entry_edit_requests: {
        Row: {
          business_id: string
          created_at: string
          id: string
          reason: string
          requested_by: string | null
          requested_changes: Json
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          staff_id: string
          status: string | null
          time_entry_id: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          reason: string
          requested_by?: string | null
          requested_changes: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_id: string
          status?: string | null
          time_entry_id: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          reason?: string
          requested_by?: string | null
          requested_changes?: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_id?: string
          status?: string | null
          time_entry_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entry_edit_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_edit_requests_employee_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_edit_requests_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_history: {
        Row: {
          business_id: string
          change_summary: Json
          changed_at: string
          changed_by_user_id: string | null
          id: string
          transaction_id: string
        }
        Insert: {
          business_id: string
          change_summary?: Json
          changed_at?: string
          changed_by_user_id?: string | null
          id?: string
          transaction_id: string
        }
        Update: {
          business_id?: string
          change_summary?: Json
          changed_at?: string
          changed_by_user_id?: string | null
          id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_history_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_history_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_line_items: {
        Row: {
          id: string
          line_total: number
          name: string
          quantity: number
          reference_id: string | null
          transaction_id: string
          type: string
          unit_price: number
        }
        Insert: {
          id?: string
          line_total: number
          name: string
          quantity?: number
          reference_id?: string | null
          transaction_id: string
          type: string
          unit_price: number
        }
        Update: {
          id?: string
          line_total?: number
          name?: string
          quantity?: number
          reference_id?: string | null
          transaction_id?: string
          type?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "transaction_line_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_refunds: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string | null
          restock_applied: boolean
          staff_id: string | null
          transaction_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason?: string | null
          restock_applied?: boolean
          staff_id?: string | null
          transaction_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string | null
          restock_applied?: boolean
          staff_id?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_refunds_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount_tendered: number | null
          appointment_id: string | null
          business_id: string
          change_given: number | null
          created_at: string
          customer_id: string | null
          discount_amount: number
          discount_label: string | null
          id: string
          is_test: boolean
          notes: string | null
          payment_method: string
          payment_method_secondary: string | null
          staff_id: string | null
          status: string
          subtotal: number
          tax_snapshot: Json | null
          tip_amount: number
          total: number
          transaction_number: number | null
          updated_at: string | null
        }
        Insert: {
          amount_tendered?: number | null
          appointment_id?: string | null
          business_id: string
          change_given?: number | null
          created_at?: string
          customer_id?: string | null
          discount_amount?: number
          discount_label?: string | null
          id?: string
          is_test?: boolean
          notes?: string | null
          payment_method: string
          payment_method_secondary?: string | null
          staff_id?: string | null
          status?: string
          subtotal?: number
          tax_snapshot?: Json | null
          tip_amount?: number
          total?: number
          transaction_number?: number | null
          updated_at?: string | null
        }
        Update: {
          amount_tendered?: number | null
          appointment_id?: string | null
          business_id?: string
          change_given?: number | null
          created_at?: string
          customer_id?: string | null
          discount_amount?: number
          discount_label?: string | null
          id?: string
          is_test?: boolean
          notes?: string | null
          payment_method?: string
          payment_method_secondary?: string | null
          staff_id?: string | null
          status?: string
          subtotal?: number
          tax_snapshot?: Json | null
          tip_amount?: number
          total?: number
          transaction_number?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          admin_notify_at: string | null
          admin_notify_sent_at: string | null
          confirm_token: string
          confirmed: boolean
          confirmed_at: string | null
          email: string
          id: string
          locale: string
          metadata: Json
          referral_code: string | null
          referred_by: string | null
          referred_by_code: string | null
          signed_up_at: string
          signup_notify_deadline_at: string | null
          source: string
          survey_skipped_at: string | null
          survey_token: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          admin_notify_at?: string | null
          admin_notify_sent_at?: string | null
          confirm_token?: string
          confirmed?: boolean
          confirmed_at?: string | null
          email: string
          id?: string
          locale?: string
          metadata?: Json
          referral_code?: string | null
          referred_by?: string | null
          referred_by_code?: string | null
          signed_up_at?: string
          signup_notify_deadline_at?: string | null
          source?: string
          survey_skipped_at?: string | null
          survey_token?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          admin_notify_at?: string | null
          admin_notify_sent_at?: string | null
          confirm_token?: string
          confirmed?: boolean
          confirmed_at?: string | null
          email?: string
          id?: string
          locale?: string
          metadata?: Json
          referral_code?: string | null
          referred_by?: string | null
          referred_by_code?: string | null
          signed_up_at?: string
          signup_notify_deadline_at?: string | null
          source?: string
          survey_skipped_at?: string | null
          survey_token?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
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
          biggest_pain: string | null
          business_name: string | null
          current_tools: string | null
          groomer_count: string | null
          id: string
          submitted_at: string
          tools_other: string | null
          tools_selected: Json
          waitlist_id: string
          wants_advanced_reports: boolean
          wants_ath_movil: boolean | null
          wants_charge_online: boolean
          wants_costo: boolean
          wants_inventory: boolean
          wants_nomina_pr: boolean | null
          wants_online_booking: boolean | null
          wants_spanish_ui: boolean | null
          wants_staff_management: boolean
        }
        Insert: {
          biggest_pain?: string | null
          business_name?: string | null
          current_tools?: string | null
          groomer_count?: string | null
          id?: string
          submitted_at?: string
          tools_other?: string | null
          tools_selected?: Json
          waitlist_id: string
          wants_advanced_reports?: boolean
          wants_ath_movil?: boolean | null
          wants_charge_online?: boolean
          wants_costo?: boolean
          wants_inventory?: boolean
          wants_nomina_pr?: boolean | null
          wants_online_booking?: boolean | null
          wants_spanish_ui?: boolean | null
          wants_staff_management?: boolean
        }
        Update: {
          biggest_pain?: string | null
          business_name?: string | null
          current_tools?: string | null
          groomer_count?: string | null
          id?: string
          submitted_at?: string
          tools_other?: string | null
          tools_selected?: Json
          waitlist_id?: string
          wants_advanced_reports?: boolean
          wants_ath_movil?: boolean | null
          wants_charge_online?: boolean
          wants_costo?: boolean
          wants_inventory?: boolean
          wants_nomina_pr?: boolean | null
          wants_online_booking?: boolean | null
          wants_spanish_ui?: boolean | null
          wants_staff_management?: boolean
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
      admin_set_profile_role: {
        Args: { p_profile_id: string; p_role: string }
        Returns: undefined
      }
      admin_set_staff_access_role: {
        Args: { p_access_role: string; p_profile_id: string }
        Returns: undefined
      }
      auth_email_is_stratum_staff: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      auth_email_super_admin_allowlisted: {
        Args: { p_email: string }
        Returns: boolean
      }
      bookable_staff_ids: {
        Args: { p_business_id: string }
        Returns: {
          id: string
        }[]
      }
      calculate_distance_meters: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      calculate_overtime_hours: {
        Args: { p_employee_id: string; p_week_start: string }
        Returns: Json
      }
      calculate_pet_age: {
        Args: { p_birth_month: number; p_birth_year: number }
        Returns: number
      }
      calculate_vaccination_status: {
        Args: { p_last_vaccination_date: string }
        Returns: string
      }
      caller_staff_access_role_for_business: {
        Args: { p_business_id: string }
        Returns: string
      }
      can_access_business: { Args: { p_business_id: string }; Returns: boolean }
      check_employee_schedule: {
        Args: { p_clock_time: string; p_employee_id: string }
        Returns: Json
      }
      check_geofence: {
        Args: {
          p_business_id: string
          p_latitude: number
          p_longitude: number
          p_support_feature_tier?: string
        }
        Returns: Json
      }
      client_has_appointment_for_business: {
        Args: { p_business_id: string; p_client_id: string }
        Returns: boolean
      }
      clock_in_out: {
        Args: {
          p_business_id: string
          p_employee_pin: string
          p_latitude?: number
          p_location_name?: string
          p_longitude?: number
          p_support_feature_tier?: string
        }
        Returns: Json
      }
      complete_employee_signup: { Args: { p_token: string }; Returns: Json }
      complete_manager_signup:
        | { Args: { p_business_name: string }; Returns: undefined }
        | {
            Args: { p_business_name: string; p_subscription_tier?: string }
            Returns: undefined
          }
      dispatch_staff_birthdays_for_business: {
        Args: { p_business_id: string }
        Returns: number
      }
      employee_birthday_matches_today: {
        Args: {
          p_birth_day: number
          p_birth_month: number
          p_local_date: string
        }
        Returns: boolean
      }
      feature_is_active: {
        Args: { p_feature_key: string; p_viewer_tier: string }
        Returns: boolean
      }
      feature_is_available_for_session: {
        Args: {
          p_feature_key: string
          p_is_super_admin?: boolean
          p_role: string
          p_subscription_tier?: string
          p_viewer_tier: string
        }
        Returns: boolean
      }
      feature_is_visible: {
        Args: { p_feature_key: string; p_viewer_tier: string }
        Returns: boolean
      }
      feature_role_visible: {
        Args: {
          p_feature_key: string
          p_is_super_admin?: boolean
          p_role: string
        }
        Returns: boolean
      }
      feature_subscription_visible: {
        Args: { p_feature_key: string; p_subscription_tier: string }
        Returns: boolean
      }
      generate_staff_pin: {
        Args: {
          p_business_id: string
          p_exclude_staff_id?: string
          p_reserved?: string
        }
        Returns: string
      }
      generate_impersonation_token: {
        Args: { target_business_id: string }
        Returns: {
          expires_at: string
          token: string
        }[]
      }
      get_employee_portal_settings: {
        Args: { p_business_id: string }
        Returns: Json
      }
      get_my_business_id: { Args: never; Returns: string }
      get_my_role: { Args: never; Returns: string }
      get_my_staff_id: { Args: never; Returns: string }
      get_public_booking_options: { Args: { p_slug: string }; Returns: Json }
      get_public_day_availability: {
        Args: { p_date: string; p_slug: string }
        Returns: Json
      }
      is_leap_year: { Args: { y: number }; Returns: boolean }
      is_public_business_slug_taken_by_other: {
        Args: { p_own_business_id: string; p_slug: string }
        Returns: boolean
      }
      is_stratumpr_email: { Args: { email: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      kiosk_staff_by_pin: {
        Args: { p_business_id: string; p_pin: string }
        Returns: {
          access_role: string
          business_id: string
          id: string
          name: string
          photo_url: string
          role: string
          status: string
        }[]
      }
      normalize_feature_key: {
        Args: { p_display_name: string }
        Returns: string
      }
      pet_has_appointment_for_business: {
        Args: { p_business_id: string; p_pet_id: string }
        Returns: boolean
      }
      profile_is_manager_or_super_admin: {
        Args: { p_uid: string }
        Returns: boolean
      }
      resolve_feature_roles_from_label: {
        Args: { p_roles_label: string }
        Returns: string[]
      }
      resolve_public_business_id: { Args: { p_slug: string }; Returns: string }
      resolve_support_feature_viewer_tier: {
        Args: { p_support_feature_tier: string }
        Returns: string
      }
      round_time_to_interval: {
        Args: { p_interval_minutes?: number; p_timestamp: string }
        Returns: string
      }
      set_profile_business_id: {
        Args: { p_business_id: string; p_uid: string }
        Returns: undefined
      }
      slugify_business_name: { Args: { p_name: string }; Returns: string }
      staff_pin_available: {
        Args: {
          p_business_id: string
          p_exclude_staff_id?: string
          p_pin: string
        }
        Returns: boolean
      }
      submit_booking_request: {
        Args: {
          p_contact_preference: string
          p_date: string
          p_email: string
          p_first_name: string
          p_last_name: string
          p_notes: string
          p_pet_breed: string
          p_pet_name: string
          p_pet_species: string
          p_phone: string
          p_service_ids: string[]
          p_slug: string
          p_staff_id: string
          p_start_time: string
        }
        Returns: Json
      }
      sync_staff_job_titles_from_staff_roles: {
        Args: { p_business_id: string }
        Returns: undefined
      }
      use_impersonation_token: {
        Args: { impersonation_token: string }
        Returns: string
      }
      validate_staff_invite: {
        Args: { invite_token: string }
        Returns: {
          business_id: string
          business_name: string
          email: string
          expires_at: string
          id: string
          status: string
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
