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
