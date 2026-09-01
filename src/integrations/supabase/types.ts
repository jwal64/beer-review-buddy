export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      beers: {
        Row: {
          abv: number | null;
          brewery: string | null;
          cc: string | null;
          city: string | null;
          country: string | null;
          created_at: string;
          created_by: string | null;
          drank_on: string;
          id: string;
          is_new: boolean;
          logo: string | null;
          logo_url: string | null;
          method: string | null;
          name: string;
          notes: string | null;
          origin_cc: string | null;
          rating: number;
          region: string | null;
          seq: number | null;
          style: string;
        };
        Insert: {
          abv?: number | null;
          brewery?: string | null;
          cc?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          drank_on?: string;
          id?: string;
          is_new?: boolean;
          logo?: string | null;
          logo_url?: string | null;
          method?: string | null;
          name: string;
          notes?: string | null;
          origin_cc?: string | null;
          rating: number;
          region?: string | null;
          seq?: number | null;
          style: string;
        };
        Update: {
          abv?: number | null;
          brewery?: string | null;
          cc?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          drank_on?: string;
          id?: string;
          is_new?: boolean;
          logo?: string | null;
          logo_url?: string | null;
          method?: string | null;
          name?: string;
          notes?: string | null;
          origin_cc?: string | null;
          rating?: number;
          region?: string | null;
          seq?: number | null;
          style?: string;
        };
        Relationships: [];
      };
      breweries: {
        Row: {
          cc: string | null;
          country: string | null;
          created_at: string;
          id: string;
          lang: string | null;
          lat: number | null;
          lng: number | null;
          location: string | null;
          logo_url: string | null;
          name: string;
          native_name: string | null;
        };
        Insert: {
          cc?: string | null;
          country?: string | null;
          created_at?: string;
          id?: string;
          lang?: string | null;
          lat?: number | null;
          lng?: number | null;
          location?: string | null;
          logo_url?: string | null;
          name: string;
          native_name?: string | null;
        };
        Update: {
          cc?: string | null;
          country?: string | null;
          created_at?: string;
          id?: string;
          lang?: string | null;
          lat?: number | null;
          lng?: number | null;
          location?: string | null;
          logo_url?: string | null;
          name?: string;
          native_name?: string | null;
        };
        Relationships: [];
      };
      countries: {
        Row: {
          cc: string;
          created_at: string;
          flag: string | null;
          name: string | null;
        };
        Insert: {
          cc: string;
          created_at?: string;
          flag?: string | null;
          name?: string | null;
        };
        Update: {
          cc?: string;
          created_at?: string;
          flag?: string | null;
          name?: string | null;
        };
        Relationships: [];
      };
      brand_domains: {
        Row: {
          beer_name: string;
          created_at: string;
          domains: string[];
        };
        Insert: {
          beer_name: string;
          created_at?: string;
          domains: string[];
        };
        Update: {
          beer_name?: string;
          created_at?: string;
          domains?: string[];
        };
        Relationships: [];
      };
      want_to_try: {
        Row: {
          abv: number | null;
          aka: string[] | null;
          beer: string;
          created_at: string;
          method: string | null;
          origin: string | null;
          region: string | null;
          seq: number | null;
          style: string;
          untappd: number | null;
        };
        Insert: {
          abv?: number | null;
          aka?: string[] | null;
          beer: string;
          created_at?: string;
          method?: string | null;
          origin?: string | null;
          region?: string | null;
          seq?: number | null;
          style: string;
          untappd?: number | null;
        };
        Update: {
          abv?: number | null;
          aka?: string[] | null;
          beer?: string;
          created_at?: string;
          method?: string | null;
          origin?: string | null;
          region?: string | null;
          seq?: number | null;
          style?: string;
          untappd?: number | null;
        };
        Relationships: [];
      };
      untappd_averages: {
        Row: {
          avg: number;
          beer_name: string;
          created_at: string;
        };
        Insert: {
          avg: number;
          beer_name: string;
          created_at?: string;
        };
        Update: {
          avg?: number;
          beer_name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      app_meta: {
        Row: {
          key: string;
          updated_at: string;
          value: string;
        };
        Insert: {
          key: string;
          updated_at?: string;
          value: string;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: string;
        };
        Relationships: [];
      };
      locations: {
        Row: {
          cc: string | null;
          city: string;
          country: string;
          created_at: string;
          id: string;
          lat: number | null;
          lng: number | null;
          region: string | null;
        };
        Insert: {
          cc?: string | null;
          city: string;
          country: string;
          created_at?: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          region?: string | null;
        };
        Update: {
          cc?: string | null;
          city?: string;
          country?: string;
          created_at?: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          region?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
