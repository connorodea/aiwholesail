export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      advanced_property_assessments: {
        Row: {
          ai_models_used: string[] | null
          confidence_score: number | null
          created_at: string | null
          detailed_assessment: Json | null
          id: string
          investment_recommendation: string | null
          market_value_impact: number | null
          opportunity_score: number | null
          overall_condition: string | null
          photos_analyzed: number | null
          risk_score: number | null
          total_repair_estimate: number
          updated_at: string | null
          user_id: string | null
          zpid: string
        }
        Insert: {
          ai_models_used?: string[] | null
          confidence_score?: number | null
          created_at?: string | null
          detailed_assessment?: Json | null
          id?: string
          investment_recommendation?: string | null
          market_value_impact?: number | null
          opportunity_score?: number | null
          overall_condition?: string | null
          photos_analyzed?: number | null
          risk_score?: number | null
          total_repair_estimate?: number
          updated_at?: string | null
          user_id?: string | null
          zpid: string
        }
        Update: {
          ai_models_used?: string[] | null
          confidence_score?: number | null
          created_at?: string | null
          detailed_assessment?: Json | null
          id?: string
          investment_recommendation?: string | null
          market_value_impact?: number | null
          opportunity_score?: number | null
          overall_condition?: string | null
          photos_analyzed?: number | null
          risk_score?: number | null
          total_repair_estimate?: number
          updated_at?: string | null
          user_id?: string | null
          zpid?: string
        }
        Relationships: []
      }
      campaign_history: {
        Row: {
          campaign_id: string | null
          campaign_type: string
          created_at: string
          id: string
          lead_id: string
          message_content: string | null
          response_content: string | null
          response_date: string | null
          response_received: boolean | null
          sent_date: string
        }
        Insert: {
          campaign_id?: string | null
          campaign_type: string
          created_at?: string
          id?: string
          lead_id: string
          message_content?: string | null
          response_content?: string | null
          response_date?: string | null
          response_received?: boolean | null
          sent_date?: string
        }
        Update: {
          campaign_id?: string | null
          campaign_type?: string
          created_at?: string
          id?: string
          lead_id?: string
          message_content?: string | null
          response_content?: string | null
          response_date?: string | null
          response_received?: boolean | null
          sent_date?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          property_data: Json
          property_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_data: Json
          property_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          property_data?: Json
          property_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_contacts: {
        Row: {
          contact_type: string
          contact_value: string
          created_at: string
          id: string
          lead_id: string
          skip_trace_confidence: number | null
          skip_trace_date: string | null
          skip_traced: boolean | null
          verified: boolean | null
        }
        Insert: {
          contact_type: string
          contact_value: string
          created_at?: string
          id?: string
          lead_id: string
          skip_trace_confidence?: number | null
          skip_trace_date?: string | null
          skip_traced?: boolean | null
          verified?: boolean | null
        }
        Update: {
          contact_type?: string
          contact_value?: string
          created_at?: string
          id?: string
          lead_id?: string
          skip_trace_confidence?: number | null
          skip_trace_date?: string | null
          skip_traced?: boolean | null
          verified?: boolean | null
        }
        Relationships: []
      }
      lead_scoring: {
        Row: {
          confidence_score: number
          contactability_score: number
          created_at: string
          id: string
          last_updated: string
          lead_id: string
          motivation_score: number
          overall_score: number
          profitability_score: number
          scoring_factors: Json | null
          urgency_score: number
        }
        Insert: {
          confidence_score?: number
          contactability_score?: number
          created_at?: string
          id?: string
          last_updated?: string
          lead_id: string
          motivation_score?: number
          overall_score?: number
          profitability_score?: number
          scoring_factors?: Json | null
          urgency_score?: number
        }
        Update: {
          confidence_score?: number
          contactability_score?: number
          created_at?: string
          id?: string
          last_updated?: string
          lead_id?: string
          motivation_score?: number
          overall_score?: number
          profitability_score?: number
          scoring_factors?: Json | null
          urgency_score?: number
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          property_data: Json
          property_id: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          property_data: Json
          property_id: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          property_data?: Json
          property_id?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      property_alert_matches: {
        Row: {
          alert_id: string
          created_at: string
          email_sent: boolean | null
          email_sent_at: string | null
          id: string
          matched_at: string
          property_data: Json
          property_id: string
          zpid: string | null
        }
        Insert: {
          alert_id: string
          created_at?: string
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          matched_at?: string
          property_data: Json
          property_id: string
          zpid?: string | null
        }
        Update: {
          alert_id?: string
          created_at?: string
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          matched_at?: string
          property_data?: Json
          property_id?: string
          zpid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_alert_matches_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "property_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      property_alerts: {
        Row: {
          alert_frequency: string | null
          created_at: string
          id: string
          is_active: boolean | null
          last_alert_sent: string | null
          location: string
          max_bathrooms: number | null
          max_bedrooms: number | null
          max_price: number | null
          max_sqft: number | null
          min_bathrooms: number | null
          min_bedrooms: number | null
          min_sqft: number | null
          property_types: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_frequency?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_alert_sent?: string | null
          location: string
          max_bathrooms?: number | null
          max_bedrooms?: number | null
          max_price?: number | null
          max_sqft?: number | null
          min_bathrooms?: number | null
          min_bedrooms?: number | null
          min_sqft?: number | null
          property_types?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_frequency?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_alert_sent?: string | null
          location?: string
          max_bathrooms?: number | null
          max_bedrooms?: number | null
          max_price?: number | null
          max_sqft?: number | null
          min_bathrooms?: number | null
          min_bedrooms?: number | null
          min_sqft?: number | null
          property_types?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_property_alerts_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_intelligence: {
        Row: {
          absentee_owner: boolean | null
          active_liens: Json | null
          assessed_value: number | null
          bankruptcy_risk: boolean | null
          code_violations: Json | null
          comparable_sales: Json | null
          corporate_owned: boolean | null
          created_at: string
          delinquent_amount: number | null
          divorce_related: boolean | null
          equity_percentage: number | null
          estimated_arv: number | null
          estimated_equity: number | null
          estimated_rehab_cost: number | null
          financial_distress: boolean | null
          foreclosure_risk: boolean | null
          id: string
          inheritance_property: boolean | null
          lot_size: number | null
          market_trends: Json | null
          market_value: number | null
          mortgage_info: Json | null
          occupancy_status: string | null
          owner_address: Json | null
          owner_name: string | null
          probate_property: boolean | null
          property_condition: string | null
          property_id: string
          square_footage: number | null
          tax_amount: number | null
          tax_delinquent: boolean | null
          tax_history: Json | null
          tax_year: number | null
          trust_owned: boolean | null
          updated_at: string
          user_id: string | null
          year_built: number | null
          zpid: string | null
        }
        Insert: {
          absentee_owner?: boolean | null
          active_liens?: Json | null
          assessed_value?: number | null
          bankruptcy_risk?: boolean | null
          code_violations?: Json | null
          comparable_sales?: Json | null
          corporate_owned?: boolean | null
          created_at?: string
          delinquent_amount?: number | null
          divorce_related?: boolean | null
          equity_percentage?: number | null
          estimated_arv?: number | null
          estimated_equity?: number | null
          estimated_rehab_cost?: number | null
          financial_distress?: boolean | null
          foreclosure_risk?: boolean | null
          id?: string
          inheritance_property?: boolean | null
          lot_size?: number | null
          market_trends?: Json | null
          market_value?: number | null
          mortgage_info?: Json | null
          occupancy_status?: string | null
          owner_address?: Json | null
          owner_name?: string | null
          probate_property?: boolean | null
          property_condition?: string | null
          property_id: string
          square_footage?: number | null
          tax_amount?: number | null
          tax_delinquent?: boolean | null
          tax_history?: Json | null
          tax_year?: number | null
          trust_owned?: boolean | null
          updated_at?: string
          user_id?: string | null
          year_built?: number | null
          zpid?: string | null
        }
        Update: {
          absentee_owner?: boolean | null
          active_liens?: Json | null
          assessed_value?: number | null
          bankruptcy_risk?: boolean | null
          code_violations?: Json | null
          comparable_sales?: Json | null
          corporate_owned?: boolean | null
          created_at?: string
          delinquent_amount?: number | null
          divorce_related?: boolean | null
          equity_percentage?: number | null
          estimated_arv?: number | null
          estimated_equity?: number | null
          estimated_rehab_cost?: number | null
          financial_distress?: boolean | null
          foreclosure_risk?: boolean | null
          id?: string
          inheritance_property?: boolean | null
          lot_size?: number | null
          market_trends?: Json | null
          market_value?: number | null
          mortgage_info?: Json | null
          occupancy_status?: string | null
          owner_address?: Json | null
          owner_name?: string | null
          probate_property?: boolean | null
          property_condition?: string | null
          property_id?: string
          square_footage?: number | null
          tax_amount?: number | null
          tax_delinquent?: boolean | null
          tax_history?: Json | null
          tax_year?: number | null
          trust_owned?: boolean | null
          updated_at?: string
          user_id?: string | null
          year_built?: number | null
          zpid?: string | null
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string | null
          event_details: Json | null
          event_type: string
          id: string
          ip_address: unknown | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_details?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_details?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          is_trial: boolean | null
          stripe_customer_id: string | null
          subscribed: boolean
          subscription_end: string | null
          subscription_tier: string | null
          trial_end: string | null
          trial_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_trial?: boolean | null
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_trial?: boolean | null
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
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
