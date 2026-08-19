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
  public: {
    Tables: {
      alerts: {
        Row: {
          body: string | null
          category: string
          created_at: string
          id: string
          is_read: boolean
          org_id: string
          property_id: string | null
          severity: string
          title: string
        }
        Insert: {
          body?: string | null
          category: string
          created_at?: string
          id?: string
          is_read?: boolean
          org_id: string
          property_id?: string | null
          severity?: string
          title: string
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean
          org_id?: string
          property_id?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_tasks: {
        Row: {
          assignee: string | null
          checkout_time: string | null
          created_at: string
          id: string
          next_checkin_time: string | null
          org_id: string
          priority: string
          property_id: string
          reservation_id: string | null
          scheduled_date: string
          status: string
        }
        Insert: {
          assignee?: string | null
          checkout_time?: string | null
          created_at?: string
          id?: string
          next_checkin_time?: string | null
          org_id: string
          priority?: string
          property_id: string
          reservation_id?: string | null
          scheduled_date: string
          status?: string
        }
        Update: {
          assignee?: string | null
          checkout_time?: string | null
          created_at?: string
          id?: string
          next_checkin_time?: string | null
          org_id?: string
          priority?: string
          property_id?: string
          reservation_id?: string | null
          scheduled_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_tasks_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          country: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          org_id: string
          phone: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          org_id: string
          phone?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          org_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          detail: string | null
          id: string
          last_sync: string | null
          org_id: string
          per_property: boolean
          provider: string
          status: string
        }
        Insert: {
          detail?: string | null
          id?: string
          last_sync?: string | null
          org_id: string
          per_property?: boolean
          provider: string
          status?: string
        }
        Update: {
          detail?: string | null
          id?: string
          last_sync?: string | null
          org_id?: string
          per_property?: boolean
          provider?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          invited_by: string | null
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_issues: {
        Row: {
          assignee: string | null
          blocks_guests: boolean
          created_at: string
          description: string | null
          id: string
          org_id: string
          priority: string
          property_id: string
          reported_on: string
          status: string
          title: string
        }
        Insert: {
          assignee?: string | null
          blocks_guests?: boolean
          created_at?: string
          description?: string | null
          id?: string
          org_id: string
          priority?: string
          property_id: string
          reported_on?: string
          status?: string
          title: string
        }
        Update: {
          assignee?: string | null
          blocks_guests?: boolean
          created_at?: string
          description?: string | null
          id?: string
          org_id?: string
          priority?: string
          property_id?: string
          reported_on?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_issues_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_issues_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          license_status: string
          license_type: string
          max_properties: number
          max_users: number
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          license_status?: string
          license_type?: string
          max_properties?: number
          max_users?: number
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          license_status?: string
          license_type?: string
          max_properties?: number
          max_users?: number
          name?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_notification_deliveries: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          id: string
          incident_id: string | null
          platform_admin_user_id: string
          provider_message_id: string | null
          recipient: string | null
          sent_at: string | null
          severity: string | null
          status: string
        }
        Insert: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          incident_id?: string | null
          platform_admin_user_id: string
          provider_message_id?: string | null
          recipient?: string | null
          sent_at?: string | null
          severity?: string | null
          status: string
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          incident_id?: string | null
          platform_admin_user_id?: string
          provider_message_id?: string | null
          recipient?: string | null
          sent_at?: string | null
          severity?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_notification_deliveries_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "system_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_notification_settings: {
        Row: {
          created_at: string
          email_enabled: boolean
          email_recipient: string | null
          id: string
          notify_critical: boolean
          notify_warning: boolean
          platform_admin_user_id: string
          updated_at: string
          warning_repeat_threshold: number
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          email_recipient?: string | null
          id?: string
          notify_critical?: boolean
          notify_warning?: boolean
          platform_admin_user_id: string
          updated_at?: string
          warning_repeat_threshold?: number
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          email_recipient?: string | null
          id?: string
          notify_critical?: boolean
          notify_warning?: boolean
          platform_admin_user_id?: string
          updated_at?: string
          warning_repeat_threshold?: number
        }
        Relationships: []
      }
      platform_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          incident_id: string | null
          platform_admin_user_id: string
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          incident_id?: string | null
          platform_admin_user_id: string
          read_at?: string | null
          title: string
          type?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          incident_id?: string | null
          platform_admin_user_id?: string
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_notifications_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "system_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          access_status: string
          company: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          org_id: string | null
          phone: string | null
        }
        Insert: {
          access_status?: string
          company?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          org_id?: string | null
          phone?: string | null
        }
        Update: {
          access_status?: string
          company?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          org_id?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          access_code: string | null
          address: string | null
          capacity: number
          check_in_time: string
          check_out_time: string
          code: string
          created_at: string
          id: string
          image_url: string | null
          instructions: string | null
          location: string
          name: string
          nightly_rate: number
          org_id: string
          status: string
          wifi_name: string | null
          wifi_password: string | null
        }
        Insert: {
          access_code?: string | null
          address?: string | null
          capacity?: number
          check_in_time?: string
          check_out_time?: string
          code: string
          created_at?: string
          id?: string
          image_url?: string | null
          instructions?: string | null
          location: string
          name: string
          nightly_rate?: number
          org_id: string
          status?: string
          wifi_name?: string | null
          wifi_password?: string | null
        }
        Update: {
          access_code?: string | null
          address?: string | null
          capacity?: number
          check_in_time?: string
          check_out_time?: string
          code?: string
          created_at?: string
          id?: string
          image_url?: string | null
          instructions?: string | null
          location?: string
          name?: string
          nightly_rate?: number
          org_id?: string
          status?: string
          wifi_name?: string | null
          wifi_password?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_blocks: {
        Row: {
          created_at: string
          end_date: string
          id: string
          note: string | null
          org_id: string
          property_id: string
          reason: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          note?: string | null
          org_id: string
          property_id: string
          reason?: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          note?: string | null
          org_id?: string
          property_id?: string
          reason?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_blocks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_blocks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          channel: string
          check_in: string
          check_out: string
          code: string
          commission: number
          created_at: string
          guest_id: string | null
          guests_count: number
          id: string
          notes: string | null
          org_id: string
          payment_status: string
          property_id: string
          status: string
          total_amount: number
        }
        Insert: {
          channel: string
          check_in: string
          check_out: string
          code: string
          commission?: number
          created_at?: string
          guest_id?: string | null
          guests_count?: number
          id?: string
          notes?: string | null
          org_id: string
          payment_status?: string
          property_id: string
          status: string
          total_amount?: number
        }
        Update: {
          channel?: string
          check_in?: string
          check_out?: string
          code?: string
          commission?: number
          created_at?: string
          guest_id?: string | null
          guests_count?: number
          id?: string
          notes?: string | null
          org_id?: string
          payment_status?: string
          property_id?: string
          status?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "reservations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      system_health_checks: {
        Row: {
          check_key: string
          check_name: string
          consecutive_failures: number
          created_at: string
          details: Json
          first_failed_at: string | null
          id: string
          last_checked_at: string
          org_id: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          check_key: string
          check_name: string
          consecutive_failures?: number
          created_at?: string
          details?: Json
          first_failed_at?: string | null
          id?: string
          last_checked_at?: string
          org_id?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          check_key?: string
          check_name?: string
          consecutive_failures?: number
          created_at?: string
          details?: Json
          first_failed_at?: string | null
          id?: string
          last_checked_at?: string
          org_id?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_incidents: {
        Row: {
          acknowledged_at: string | null
          check_key: string
          created_at: string
          description: string | null
          detected_at: string
          fingerprint: string
          id: string
          metadata: Json
          org_id: string | null
          recommended_action: string | null
          resolved_at: string | null
          severity: string
          source: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          check_key: string
          created_at?: string
          description?: string | null
          detected_at?: string
          fingerprint: string
          id?: string
          metadata?: Json
          org_id?: string | null
          recommended_action?: string | null
          resolved_at?: string | null
          severity?: string
          source?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          check_key?: string
          created_at?: string
          description?: string | null
          detected_at?: string
          fingerprint?: string
          id?: string
          metadata?: Json
          org_id?: string | null
          recommended_action?: string | null
          resolved_at?: string | null
          severity?: string
          source?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          email: string | null
          id: string
          last_access: string | null
          name: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          last_access?: string | null
          name: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          last_access?: string | null
          name?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category: string
          channel: string | null
          created_at: string
          description: string | null
          id: string
          kind: string
          occurred_on: string
          org_id: string
          property_id: string | null
          reservation_id: string | null
        }
        Insert: {
          amount: number
          category: string
          channel?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kind: string
          occurred_on: string
          org_id: string
          property_id?: string | null
          reservation_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          channel?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          occurred_on?: string
          org_id?: string
          property_id?: string | null
          reservation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_automations: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          org_id: string
          template_id: string | null
          trigger_event: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          org_id: string
          template_id?: string | null
          trigger_event: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          template_id?: string | null
          trigger_event?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_automations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_automations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string
          guest_id: string | null
          id: string
          org_id: string
          property_id: string | null
          reservation_id: string | null
          sent_at: string
          status: string
          template_name: string | null
        }
        Insert: {
          body: string
          guest_id?: string | null
          id?: string
          org_id: string
          property_id?: string | null
          reservation_id?: string | null
          sent_at?: string
          status?: string
          template_name?: string | null
        }
        Update: {
          body?: string
          guest_id?: string | null
          id?: string
          org_id?: string
          property_id?: string | null
          reservation_id?: string | null
          sent_at?: string
          status?: string
          template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      platform_acknowledge_incident: {
        Args: { _incident_id: string }
        Returns: {
          acknowledged_at: string | null
          check_key: string
          created_at: string
          description: string | null
          detected_at: string
          fingerprint: string
          id: string
          metadata: Json
          org_id: string | null
          recommended_action: string | null
          resolved_at: string | null
          severity: string
          source: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "system_incidents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      platform_health_summary: { Args: never; Returns: Json }
      platform_list_organizations: {
        Args: never
        Returns: {
          created_at: string
          id: string
          license_status: string
          license_type: string
          max_properties: number
          max_users: number
          name: string
        }[]
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      platform_list_users: {
        Args: never
        Returns: {
          access_status: string
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          org_id: string
          org_name: string
        }[]
      }
      platform_mark_notifications_read: {
        Args: { _ids?: string[] }
        Returns: number
      }
      platform_pending_email_alerts: {
        Args: never
        Returns: {
          description: string
          detected_at: string
          incident_id: string
          org_name: string
          platform_admin_user_id: string
          recipient: string
          recommended_action: string
          severity: string
          title: string
        }[]
      }
      platform_record_email_delivery: {
        Args: {
          _error_message?: string
          _incident_id: string
          _platform_admin_user_id: string
          _provider_message_id?: string
          _recipient: string
          _severity: string
          _status: string
        }
        Returns: string
      }
      platform_stats: { Args: never; Returns: Json }
      platform_update_license: {
        Args: {
          _license_status?: string
          _license_type?: string
          _max_properties?: number
          _max_users?: number
          _org_id: string
        }
        Returns: {
          created_at: string
          id: string
          license_status: string
          license_type: string
          max_properties: number
          max_users: number
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_health_check: {
        Args: {
          _action: string
          _description: string
          _details: Json
          _key: string
          _name: string
          _org_id: string
          _severity: string
          _status: string
          _title: string
        }
        Returns: undefined
      }
      run_platform_health_check: { Args: never; Returns: Json }
    }
    Enums: {
      app_role:
        | "owner"
        | "manager"
        | "reception"
        | "cleaning"
        | "maintenance"
        | "accounting"
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
    Enums: {
      app_role: [
        "owner",
        "manager",
        "reception",
        "cleaning",
        "maintenance",
        "accounting",
      ],
    },
  },
} as const
