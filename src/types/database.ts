export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          hourly_rate: number;
          plan: "free" | "pro" | "founder";
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          google_access_token: string | null;
          google_refresh_token: string | null;
          master_prompt: string | null;
          onboarding_complete: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      audits: {
        Row: {
          id: string;
          user_id: string;
          status: "pending" | "running" | "complete" | "failed";
          time_thieves: Json;
          total_hours_wasted: number;
          total_dollar_cost: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["audits"]["Row"], "created_at">;
        Update: Partial<Database["public"]["Tables"]["audits"]["Insert"]>;
      };
      agents: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          name: string;
          description: string;
          status: "active" | "paused" | "stopped";
          tasks_completed: number;
          hours_saved: number;
          last_run_at: string | null;
          config: Json;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["agents"]["Row"], "created_at">;
        Update: Partial<Database["public"]["Tables"]["agents"]["Insert"]>;
      };
      agent_actions: {
        Row: {
          id: string;
          agent_id: string;
          user_id: string;
          type: string;
          summary: string;
          content: Json;
          status: "pending_review" | "approved" | "dismissed";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["agent_actions"]["Row"], "created_at">;
        Update: Partial<Database["public"]["Tables"]["agent_actions"]["Insert"]>;
      };
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Audit = Database["public"]["Tables"]["audits"]["Row"];
export type Agent = Database["public"]["Tables"]["agents"]["Row"];
export type AgentAction = Database["public"]["Tables"]["agent_actions"]["Row"];

// Public-safe variants — no OAuth tokens, no Stripe ids, no master_prompt
// (which holds the user's operational context), no payload blobs.
// Use these for any data that crosses the server-to-client boundary.
export type PublicProfile = Omit<
  Profile,
  | "google_access_token"
  | "google_refresh_token"
  | "stripe_customer_id"
  | "stripe_subscription_id"
  | "master_prompt"
>;
export type PublicAgent = Omit<Agent, "config">;
export type PublicAudit = Omit<Audit, "time_thieves">;
export type PublicAgentAction = AgentAction;

export interface TimeThief {
  id: string;
  title: string;
  description: string;
  category: "email" | "meetings" | "admin" | "content" | "research" | "follow_up";
  hours_per_week: number;
  dollar_cost_per_week: number;
  transfer_score: number;
  examples: string[];
  recommended_agent: string;
}
