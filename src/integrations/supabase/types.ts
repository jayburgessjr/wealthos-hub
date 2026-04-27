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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      compound_settings: {
        Row: {
          allocations: Json | null
          id: string
          max_drawdown_pct: number | null
          monthly_contribution: number | null
          reinvestment_pct: number | null
          risk_tier: string | null
          starting_capital: number | null
          target_return_pct: number | null
          time_horizon_months: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allocations?: Json | null
          id?: string
          max_drawdown_pct?: number | null
          monthly_contribution?: number | null
          reinvestment_pct?: number | null
          risk_tier?: string | null
          starting_capital?: number | null
          target_return_pct?: number | null
          time_horizon_months?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allocations?: Json | null
          id?: string
          max_drawdown_pct?: number | null
          monthly_contribution?: number | null
          reinvestment_pct?: number | null
          risk_tier?: string | null
          starting_capital?: number | null
          target_return_pct?: number | null
          time_horizon_months?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      portfolios: {
        Row: {
          available_capital: number | null
          deployed_capital: number | null
          id: string
          total_capital: number | null
          total_pnl: number | null
          total_pnl_pct: number | null
          total_trades: number | null
          updated_at: string | null
          user_id: string
          win_rate: number | null
        }
        Insert: {
          available_capital?: number | null
          deployed_capital?: number | null
          id?: string
          total_capital?: number | null
          total_pnl?: number | null
          total_pnl_pct?: number | null
          total_trades?: number | null
          updated_at?: string | null
          user_id: string
          win_rate?: number | null
        }
        Update: {
          available_capital?: number | null
          deployed_capital?: number | null
          id?: string
          total_capital?: number | null
          total_pnl?: number | null
          total_pnl_pct?: number | null
          total_trades?: number | null
          updated_at?: string | null
          user_id?: string
          win_rate?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          email: string | null
          stripe_customer_id: string | null
          subscription_status: string | null
          subscription_plan: string | null
          is_admin: boolean | null
          onboarding_completed: boolean | null
          updated_at: string | null
        }
        Insert: {
          id: string
          email?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          subscription_plan?: string | null
          is_admin?: boolean | null
          onboarding_completed?: boolean | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          email?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          subscription_plan?: string | null
          is_admin?: boolean | null
          onboarding_completed?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      positions: {
        Row: {
          asset_class: string | null
          company_name: string | null
          created_at: string | null
          current_price: number | null
          entry_date: string
          entry_price: number
          expiry_date: string | null
          id: string
          notes: string | null
          pnl_dollars: number | null
          pnl_percent: number | null
          shares_contracts: number
          signal_score: number | null
          status: string | null
          strategy_type: string | null
          strike_price: number | null
          ticker: string
          user_id: string
          value: number | null
        }
        Insert: {
          asset_class?: string | null
          company_name?: string | null
          created_at?: string | null
          current_price?: number | null
          entry_date: string
          entry_price: number
          expiry_date?: string | null
          id?: string
          notes?: string | null
          pnl_dollars?: number | null
          pnl_percent?: number | null
          shares_contracts: number
          signal_score?: number | null
          status?: string | null
          strategy_type?: string | null
          strike_price?: number | null
          ticker: string
          user_id: string
          value?: number | null
        }
        Update: {
          asset_class?: string | null
          company_name?: string | null
          created_at?: string | null
          current_price?: number | null
          entry_date?: string
          entry_price?: number
          expiry_date?: string | null
          id?: string
          notes?: string | null
          pnl_dollars?: number | null
          pnl_percent?: number | null
          shares_contracts?: number
          signal_score?: number | null
          status?: string | null
          strategy_type?: string | null
          strike_price?: number | null
          ticker?: string
          user_id?: string
          value?: number | null
        }
        Relationships: []
      }
      signals: {
        Row: {
          action: string | null
          asset_class: string | null
          company_name: string | null
          created_at: string | null
          entry_price: number | null
          expected_return_pct: number | null
          expires_at: string | null
          id: string
          macro_score: number | null
          options_flow_score: number | null
          position_size_dollars: number | null
          position_size_pct: number | null
          reasoning: Json | null
          sentiment_score: number | null
          signal_score: number | null
          stop_price: number | null
          strategy_type: string
          target_price: number | null
          technical_score: number | null
          ticker: string
          time_horizon_days: number | null
        }
        Insert: {
          action?: string | null
          asset_class?: string | null
          company_name?: string | null
          created_at?: string | null
          entry_price?: number | null
          expected_return_pct?: number | null
          expires_at?: string | null
          id?: string
          macro_score?: number | null
          options_flow_score?: number | null
          position_size_dollars?: number | null
          position_size_pct?: number | null
          reasoning?: Json | null
          sentiment_score?: number | null
          signal_score?: number | null
          stop_price?: number | null
          strategy_type: string
          target_price?: number | null
          technical_score?: number | null
          ticker: string
          time_horizon_days?: number | null
        }
        Update: {
          action?: string | null
          asset_class?: string | null
          company_name?: string | null
          created_at?: string | null
          entry_price?: number | null
          expected_return_pct?: number | null
          expires_at?: string | null
          id?: string
          macro_score?: number | null
          options_flow_score?: number | null
          position_size_dollars?: number | null
          position_size_pct?: number | null
          reasoning?: Json | null
          sentiment_score?: number | null
          signal_score?: number | null
          stop_price?: number | null
          strategy_type?: string
          target_price?: number | null
          technical_score?: number | null
          ticker?: string
          time_horizon_days?: number | null
        }
        Relationships: []
      }
      strategy_performance: {
        Row: {
          avg_hold_days: number | null
          avg_return_pct: number | null
          best_trade_pct: number | null
          capital_allocated: number | null
          id: string
          strategy_type: string
          total_pnl: number | null
          total_trades: number | null
          updated_at: string | null
          user_id: string
          winning_trades: number | null
          worst_trade_pct: number | null
        }
        Insert: {
          avg_hold_days?: number | null
          avg_return_pct?: number | null
          best_trade_pct?: number | null
          capital_allocated?: number | null
          id?: string
          strategy_type: string
          total_pnl?: number | null
          total_trades?: number | null
          updated_at?: string | null
          user_id: string
          winning_trades?: number | null
          worst_trade_pct?: number | null
        }
        Update: {
          avg_hold_days?: number | null
          avg_return_pct?: number | null
          best_trade_pct?: number | null
          capital_allocated?: number | null
          id?: string
          strategy_type?: string
          total_pnl?: number | null
          total_trades?: number | null
          updated_at?: string | null
          user_id?: string
          winning_trades?: number | null
          worst_trade_pct?: number | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          action: string | null
          executed_at: string | null
          fees: number | null
          id: string
          notes: string | null
          pnl_realized: number | null
          position_id: string | null
          price: number
          quantity: number
          signal_score_at_entry: number | null
          strategy_type: string | null
          ticker: string
          total_value: number
          user_id: string
        }
        Insert: {
          action?: string | null
          executed_at?: string | null
          fees?: number | null
          id?: string
          notes?: string | null
          pnl_realized?: number | null
          position_id?: string | null
          price: number
          quantity: number
          signal_score_at_entry?: number | null
          strategy_type?: string | null
          ticker: string
          total_value: number
          user_id: string
        }
        Update: {
          action?: string | null
          executed_at?: string | null
          fees?: number | null
          id?: string
          notes?: string | null
          pnl_realized?: number | null
          position_id?: string | null
          price?: number
          quantity?: number
          signal_score_at_entry?: number | null
          strategy_type?: string | null
          ticker?: string
          total_value?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist: {
        Row: {
          added_at: string | null
          alert_price_above: number | null
          alert_price_below: number | null
          alert_signal_above: number | null
          company_name: string | null
          id: string
          ticker: string
          user_id: string
        }
        Insert: {
          added_at?: string | null
          alert_price_above?: number | null
          alert_price_below?: number | null
          alert_signal_above?: number | null
          company_name?: string | null
          id?: string
          ticker: string
          user_id: string
        }
        Update: {
          added_at?: string | null
          alert_price_above?: number | null
          alert_price_below?: number | null
          alert_signal_above?: number | null
          company_name?: string | null
          id?: string
          ticker?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
