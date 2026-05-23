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
      admin_activity_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          starts_at: string
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          starts_at?: string
          title: string
          type?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          starts_at?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      deposit_credits: {
        Row: {
          amount_credited: number
          amount_received: number
          created_at: string
          deposit_id: string
          id: string
          notes: string | null
          source: string
          target_wallet: string
          user_id: string
        }
        Insert: {
          amount_credited: number
          amount_received: number
          created_at?: string
          deposit_id: string
          id?: string
          notes?: string | null
          source: string
          target_wallet: string
          user_id: string
        }
        Update: {
          amount_credited?: number
          amount_received?: number
          created_at?: string
          deposit_id?: string
          id?: string
          notes?: string | null
          source?: string
          target_wallet?: string
          user_id?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          admin_notes: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          id: string
          network: string
          status: string | null
          target_wallet: string
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
          network?: string
          status?: string | null
          target_wallet?: string
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
          network?: string
          status?: string | null
          target_wallet?: string
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
      login_events: {
        Row: {
          created_at: string
          id: string
          ip: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mining_rentals: {
        Row: {
          coin: string
          created_at: string
          daily_max_pct: number
          daily_min_pct: number
          efficiency: number
          ends_at: string
          hashrate: number
          id: string
          last_yield_at: string
          locked_amount: number
          runtime_days: number
          started_at: string
          status: string
          tier: string
          total_yield: number
          user_id: string
        }
        Insert: {
          coin: string
          created_at?: string
          daily_max_pct: number
          daily_min_pct: number
          efficiency?: number
          ends_at: string
          hashrate?: number
          id?: string
          last_yield_at?: string
          locked_amount: number
          runtime_days: number
          started_at?: string
          status?: string
          tier: string
          total_yield?: number
          user_id: string
        }
        Update: {
          coin?: string
          created_at?: string
          daily_max_pct?: number
          daily_min_pct?: number
          efficiency?: number
          ends_at?: string
          hashrate?: number
          id?: string
          last_yield_at?: string
          locked_amount?: number
          runtime_days?: number
          started_at?: string
          status?: string
          tier?: string
          total_yield?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          earnings_mining: number
          earnings_referral: number
          earnings_staking: number
          email: string
          id: string
          is_frozen: boolean
          is_mining: boolean | null
          last_login_at: string | null
          last_login_ip: string | null
          last_mining_start: string | null
          mining_ends_at: string | null
          mining_power_multiplier: number | null
          mining_streak: number | null
          mining_wallet: number
          referral_code: string
          referred_by: string | null
          staking_wallet: number
          total_mined: number | null
          trading_wallet: number
          updated_at: string | null
          user_id: string
          username: string | null
          wallet_balance: number | null
          withdrawable_earnings: number
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          earnings_mining?: number
          earnings_referral?: number
          earnings_staking?: number
          email: string
          id?: string
          is_frozen?: boolean
          is_mining?: boolean | null
          last_login_at?: string | null
          last_login_ip?: string | null
          last_mining_start?: string | null
          mining_ends_at?: string | null
          mining_power_multiplier?: number | null
          mining_streak?: number | null
          mining_wallet?: number
          referral_code?: string
          referred_by?: string | null
          staking_wallet?: number
          total_mined?: number | null
          trading_wallet?: number
          updated_at?: string | null
          user_id: string
          username?: string | null
          wallet_balance?: number | null
          withdrawable_earnings?: number
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          earnings_mining?: number
          earnings_referral?: number
          earnings_staking?: number
          email?: string
          id?: string
          is_frozen?: boolean
          is_mining?: boolean | null
          last_login_at?: string | null
          last_login_ip?: string | null
          last_mining_start?: string | null
          mining_ends_at?: string | null
          mining_power_multiplier?: number | null
          mining_streak?: number | null
          mining_wallet?: number
          referral_code?: string
          referred_by?: string | null
          staking_wallet?: number
          total_mined?: number | null
          trading_wallet?: number
          updated_at?: string | null
          user_id?: string
          username?: string | null
          wallet_balance?: number | null
          withdrawable_earnings?: number
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
          deposit_id: string | null
          id: string
          kind: string
          percentage: number
          referred_id: string
          referrer_id: string
          stake_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          deposit_id?: string | null
          id?: string
          kind?: string
          percentage: number
          referred_id: string
          referrer_id: string
          stake_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          deposit_id?: string | null
          id?: string
          kind?: string
          percentage?: number
          referred_id?: string
          referrer_id?: string
          stake_id?: string | null
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
          last_search_at: string | null
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
          last_search_at?: string | null
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
          last_search_at?: string | null
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
          max_daily_rate: number | null
          min_daily_rate: number | null
          minimum_amount: number
          name: string
          required_referrals: number
        }
        Insert: {
          created_at?: string | null
          daily_return_rate: number
          duration_days: number
          id?: string
          is_active?: boolean | null
          max_daily_rate?: number | null
          min_daily_rate?: number | null
          minimum_amount?: number
          name: string
          required_referrals?: number
        }
        Update: {
          created_at?: string | null
          daily_return_rate?: number
          duration_days?: number
          id?: string
          is_active?: boolean | null
          max_daily_rate?: number | null
          min_daily_rate?: number | null
          minimum_amount?: number
          name?: string
          required_referrals?: number
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
      trading_sessions: {
        Row: {
          capital: number
          created_at: string
          ends_at: string
          id: string
          profit: number
          started_at: string
          status: string
          trades_json: Json
          user_id: string
          win_rate: number
        }
        Insert: {
          capital: number
          created_at?: string
          ends_at: string
          id?: string
          profit?: number
          started_at?: string
          status?: string
          trades_json?: Json
          user_id: string
          win_rate?: number
        }
        Update: {
          capital?: number
          created_at?: string
          ends_at?: string
          id?: string
          profit?: number
          started_at?: string
          status?: string
          trades_json?: Json
          user_id?: string
          win_rate?: number
        }
        Relationships: []
      }
      user_miners: {
        Row: {
          created_at: string
          efficiency: number
          expires_at: string
          hashrate: number
          id: string
          is_mining: boolean
          last_started_at: string | null
          lifespan_days: number
          max_daily_return: number
          min_daily_return: number
          miner_tier: string
          miner_type: string
          mining_ends_at: string | null
          price: number
          purchased_at: string
          total_mined: number
          user_id: string
        }
        Insert: {
          created_at?: string
          efficiency: number
          expires_at: string
          hashrate: number
          id?: string
          is_mining?: boolean
          last_started_at?: string | null
          lifespan_days: number
          max_daily_return: number
          min_daily_return: number
          miner_tier: string
          miner_type: string
          mining_ends_at?: string | null
          price: number
          purchased_at?: string
          total_mined?: number
          user_id: string
        }
        Update: {
          created_at?: string
          efficiency?: number
          expires_at?: string
          hashrate?: number
          id?: string
          is_mining?: boolean
          last_started_at?: string | null
          lifespan_days?: number
          max_daily_return?: number
          min_daily_return?: number
          miner_tier?: string
          miner_type?: string
          mining_ends_at?: string | null
          price?: number
          purchased_at?: string
          total_mined?: number
          user_id?: string
        }
        Relationships: []
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
      wallet_transfers: {
        Row: {
          amount: number
          created_at: string
          from_wallet: string
          id: string
          to_wallet: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          from_wallet: string
          id?: string
          to_wallet: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          from_wallet?: string
          id?: string
          to_wallet?: string
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
          source: string
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
          source?: string
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
          source?: string
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
      accrue_mining_yields: { Args: never; Returns: Json }
      add_daily_staking_earnings: { Args: never; Returns: undefined }
      admin_adjust_balance: {
        Args: {
          p_delta: number
          p_note: string
          p_user_id: string
          p_wallet: string
        }
        Returns: Json
      }
      admin_credit_reward: {
        Args: {
          p_amount: number
          p_note: string
          p_user_id: string
          p_wallet: string
        }
        Returns: Json
      }
      admin_daily_growth: {
        Args: { p_days?: number }
        Returns: {
          day: string
          deposits: number
          signups: number
          withdrawals: number
        }[]
      }
      admin_process_withdrawal: {
        Args: { p_action: string; p_id: string; p_note: string }
        Returns: Json
      }
      admin_set_setting: {
        Args: { p_key: string; p_value: string }
        Returns: Json
      }
      admin_stats: { Args: never; Returns: Json }
      admin_top_referrers: {
        Args: { p_limit?: number }
        Returns: {
          email: string
          qualified_count: number
          referral_code: string
          total_earnings: number
          user_id: string
          username: string
        }[]
      }
      admin_update_deposit_status: {
        Args: { p_id: string; p_note: string; p_status: string }
        Returns: Json
      }
      assert_not_frozen: { Args: { _user_id: string }; Returns: undefined }
      claim_miner_rewards: { Args: { p_miner_id: string }; Returns: Json }
      claim_mining_rewards: { Args: never; Returns: Json }
      claim_trading_session: { Args: never; Returns: Json }
      complete_expired_stakes: { Args: never; Returns: number }
      create_stake: {
        Args: { p_amount: number; p_plan_id: string }
        Returns: Json
      }
      credit_referrer_yield_share: {
        Args: { p_referee: string; p_stake_id: string; p_yield: number }
        Returns: undefined
      }
      get_my_referred_users: {
        Args: never
        Returns: {
          created_at: string
          user_id: string
          username: string
        }[]
      }
      get_staking_referral_team: {
        Args: never
        Returns: {
          created_at: string
          qualified: boolean
          total_staking_deposits: number
          user_id: string
          username: string
        }[]
      }
      get_trading_referral_team: {
        Args: never
        Returns: {
          created_at: string
          qualified: boolean
          trading_level: number
          user_id: string
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_login_event: {
        Args: { p_ip: string; p_ua: string }
        Returns: undefined
      }
      process_daily_staking_returns: { Args: never; Returns: undefined }
      purchase_miner: {
        Args: { p_tier: string; p_type: string }
        Returns: Json
      }
      qualified_referrals_count: { Args: { _user_id: string }; Returns: number }
      qualified_trading_referrals_count: {
        Args: { _user_id: string }
        Returns: number
      }
      request_withdrawal: {
        Args: { p_address: string; p_amount: number; p_source: string }
        Returns: Json
      }
      run_ai_scalping: { Args: never; Returns: Json }
      search_exchange: { Args: { p_stake_id: string }; Returns: Json }
      start_cloud_mining: { Args: never; Returns: Json }
      start_miner: { Args: { p_miner_id: string }; Returns: Json }
      start_mining_rental: {
        Args: { p_coin: string; p_tier: string }
        Returns: Json
      }
      start_trading_session: { Args: never; Returns: Json }
      transfer_between_wallets: {
        Args: { p_amount: number; p_from: string; p_to: string }
        Returns: Json
      }
      update_wallet_balance: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
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
