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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      deposits: {
        Row: {
          admin_notes: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          id: string
          status: string | null
          transaction_hash: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          transaction_hash: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          transaction_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposits_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deposits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_mining: boolean | null
          last_mining_start: string | null
          mining_ends_at: string | null
          mining_power_multiplier: number | null
          mining_streak: number | null
          referral_code: string
          referred_by: string | null
          total_mined: number | null
          updated_at: string | null
          user_id: string
          username: string | null
          wallet_balance: number | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_mining?: boolean | null
          last_mining_start?: string | null
          mining_ends_at?: string | null
          mining_power_multiplier?: number | null
          mining_streak?: number | null
          referral_code?: string
          referred_by?: string | null
          total_mined?: number | null
          updated_at?: string | null
          user_id: string
          username?: string | null
          wallet_balance?: number | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_mining?: boolean | null
          last_mining_start?: string | null
          mining_ends_at?: string | null
          mining_power_multiplier?: number | null
          mining_streak?: number | null
          referral_code?: string
          referred_by?: string | null
          total_mined?: number | null
          updated_at?: string | null
          user_id?: string
          username?: string | null
          wallet_balance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      referral_earnings: {
        Row: {
          amount: number
          created_at: string | null
          deposit_id: string
          id: string
          percentage: number
          referred_id: string
          referrer_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          deposit_id: string
          id?: string
          percentage: number
          referred_id: string
          referrer_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          deposit_id?: string
          id?: string
          percentage?: number
          referred_id?: string
          referrer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_earnings_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: true
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_earnings_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "referral_earnings_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      stakes: {
        Row: {
          amount: number
          created_at: string | null
          daily_return: number
          end_date: string
          id: string
          is_active: boolean | null
          plan_id: string
          principal_withdrawn: boolean | null
          start_date: string | null
          total_earned: number | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          daily_return: number
          end_date: string
          id?: string
          is_active?: boolean | null
          plan_id: string
          principal_withdrawn?: boolean | null
          start_date?: string | null
          total_earned?: number | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          daily_return?: number
          end_date?: string
          id?: string
          is_active?: boolean | null
          plan_id?: string
          principal_withdrawn?: boolean | null
          start_date?: string | null
          total_earned?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stakes_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "staking_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stakes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      staking_plans: {
        Row: {
          created_at: string | null
          daily_return_rate: number
          duration_days: number
          id: string
          is_active: boolean | null
          minimum_amount: number
          name: string
        }
        Insert: {
          created_at?: string | null
          daily_return_rate: number
          duration_days: number
          id?: string
          is_active?: boolean | null
          minimum_amount?: number
          name: string
        }
        Update: {
          created_at?: string | null
          daily_return_rate?: number
          duration_days?: number
          id?: string
          is_active?: boolean | null
          minimum_amount?: number
          name?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string | null
          fee_amount: number
          id: string
          net_amount: number
          processed_at: string | null
          processed_by: string | null
          stake_id: string | null
          status: string | null
          user_id: string
          withdrawal_address: string
          withdrawal_type: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string | null
          fee_amount: number
          id?: string
          net_amount: number
          processed_at?: string | null
          processed_by?: string | null
          stake_id?: string | null
          status?: string | null
          user_id: string
          withdrawal_address?: string
          withdrawal_type: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string | null
          fee_amount?: number
          id?: string
          net_amount?: number
          processed_at?: string | null
          processed_by?: string | null
          stake_id?: string | null
          status?: string | null
          user_id?: string
          withdrawal_address?: string
          withdrawal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "withdrawals_stake_id_fkey"
            columns: ["stake_id"]
            isOneToOne: false
            referencedRelation: "stakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_daily_staking_earnings: { Args: never; Returns: undefined }
      claim_mining_rewards: { Args: never; Returns: Json }
      complete_expired_stakes: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      process_daily_staking_returns: { Args: never; Returns: undefined }
      start_cloud_mining: { Args: never; Returns: Json }
      validate_referral_code: { Args: { code: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
