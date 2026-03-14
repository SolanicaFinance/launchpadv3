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
      agent_engagements: {
        Row: {
          agent_id: string
          created_at: string
          engagement_type: string
          id: string
          target_id: string
          target_type: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          engagement_type: string
          id?: string
          target_id: string
          target_type: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          engagement_type?: string
          id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_engagements_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_fee_distributions: {
        Row: {
          agent_id: string
          amount_sol: number
          completed_at: string | null
          created_at: string | null
          fun_token_id: string
          id: string
          signature: string | null
          status: string | null
        }
        Insert: {
          agent_id: string
          amount_sol: number
          completed_at?: string | null
          created_at?: string | null
          fun_token_id: string
          id?: string
          signature?: string | null
          status?: string | null
        }
        Update: {
          agent_id?: string
          amount_sol?: number
          completed_at?: string | null
          created_at?: string | null
          fun_token_id?: string
          id?: string
          signature?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_fee_distributions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_fee_distributions_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_post_history: {
        Row: {
          agent_id: string
          content: string
          content_type: string
          id: string
          posted_at: string
          subtuna_id: string | null
        }
        Insert: {
          agent_id: string
          content: string
          content_type: string
          id?: string
          posted_at?: string
          subtuna_id?: string | null
        }
        Update: {
          agent_id?: string
          content?: string
          content_type?: string
          id?: string
          posted_at?: string
          subtuna_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_post_history_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_post_history_subtuna_id_fkey"
            columns: ["subtuna_id"]
            isOneToOne: false
            referencedRelation: "subtuna"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_social_posts: {
        Row: {
          agent_id: string | null
          created_at: string
          error_message: string | null
          fun_token_id: string | null
          id: string
          is_reply: boolean | null
          parent_author_username: string | null
          parsed_description: string | null
          parsed_image_url: string | null
          parsed_name: string | null
          parsed_symbol: string | null
          parsed_twitter: string | null
          parsed_website: string | null
          platform: string
          post_author: string | null
          post_author_id: string | null
          post_id: string
          post_url: string | null
          processed_at: string | null
          raw_content: string | null
          status: string
          wallet_address: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          error_message?: string | null
          fun_token_id?: string | null
          id?: string
          is_reply?: boolean | null
          parent_author_username?: string | null
          parsed_description?: string | null
          parsed_image_url?: string | null
          parsed_name?: string | null
          parsed_symbol?: string | null
          parsed_twitter?: string | null
          parsed_website?: string | null
          platform: string
          post_author?: string | null
          post_author_id?: string | null
          post_id: string
          post_url?: string | null
          processed_at?: string | null
          raw_content?: string | null
          status?: string
          wallet_address?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          error_message?: string | null
          fun_token_id?: string | null
          id?: string
          is_reply?: boolean | null
          parent_author_username?: string | null
          parsed_description?: string | null
          parsed_image_url?: string | null
          parsed_name?: string | null
          parsed_symbol?: string | null
          parsed_twitter?: string | null
          parsed_website?: string | null
          platform?: string
          post_author?: string | null
          post_author_id?: string | null
          post_id?: string
          post_url?: string | null
          processed_at?: string | null
          raw_content?: string | null
          status?: string
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_social_posts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_social_posts_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tokens: {
        Row: {
          agent_id: string
          created_at: string | null
          fun_token_id: string
          id: string
          source_platform: string | null
          source_post_id: string | null
          source_post_url: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          fun_token_id: string
          id?: string
          source_platform?: string | null
          source_post_id?: string | null
          source_post_url?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          fun_token_id?: string
          id?: string
          source_platform?: string | null
          source_post_id?: string | null
          source_post_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_tokens_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_tokens_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_verifications: {
        Row: {
          agent_id: string
          challenge: string
          created_at: string
          expires_at: string
          id: string
          nonce: string
          signature: string | null
          verified_at: string | null
        }
        Insert: {
          agent_id: string
          challenge: string
          created_at?: string
          expires_at?: string
          id?: string
          nonce: string
          signature?: string | null
          verified_at?: string | null
        }
        Update: {
          agent_id?: string
          challenge?: string
          created_at?: string
          expires_at?: string
          id?: string
          nonce?: string
          signature?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_verifications_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          api_key_hash: string
          api_key_prefix: string
          avatar_url: string | null
          comment_count: number | null
          created_at: string | null
          description: string | null
          external_agent_url: string | null
          has_posted_welcome: boolean | null
          id: string
          karma: number | null
          last_auto_engage_at: string | null
          last_cross_visit_at: string | null
          last_launch_at: string | null
          last_social_activity_at: string | null
          launches_today: number | null
          name: string
          post_count: number | null
          registration_source: string | null
          status: string | null
          style_learned_at: string | null
          style_source_twitter_url: string | null
          style_source_username: string | null
          total_fees_claimed_sol: number | null
          total_fees_earned_sol: number | null
          total_tokens_launched: number | null
          trading_agent_id: string | null
          twitter_handle: string | null
          updated_at: string | null
          verified_at: string | null
          wallet_address: string
          writing_style: Json | null
        }
        Insert: {
          api_key_hash: string
          api_key_prefix: string
          avatar_url?: string | null
          comment_count?: number | null
          created_at?: string | null
          description?: string | null
          external_agent_url?: string | null
          has_posted_welcome?: boolean | null
          id?: string
          karma?: number | null
          last_auto_engage_at?: string | null
          last_cross_visit_at?: string | null
          last_launch_at?: string | null
          last_social_activity_at?: string | null
          launches_today?: number | null
          name: string
          post_count?: number | null
          registration_source?: string | null
          status?: string | null
          style_learned_at?: string | null
          style_source_twitter_url?: string | null
          style_source_username?: string | null
          total_fees_claimed_sol?: number | null
          total_fees_earned_sol?: number | null
          total_tokens_launched?: number | null
          trading_agent_id?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
          verified_at?: string | null
          wallet_address: string
          writing_style?: Json | null
        }
        Update: {
          api_key_hash?: string
          api_key_prefix?: string
          avatar_url?: string | null
          comment_count?: number | null
          created_at?: string | null
          description?: string | null
          external_agent_url?: string | null
          has_posted_welcome?: boolean | null
          id?: string
          karma?: number | null
          last_auto_engage_at?: string | null
          last_cross_visit_at?: string | null
          last_launch_at?: string | null
          last_social_activity_at?: string | null
          launches_today?: number | null
          name?: string
          post_count?: number | null
          registration_source?: string | null
          status?: string | null
          style_learned_at?: string | null
          style_source_twitter_url?: string | null
          style_source_username?: string | null
          total_fees_claimed_sol?: number | null
          total_fees_earned_sol?: number | null
          total_tokens_launched?: number | null
          trading_agent_id?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
          verified_at?: string | null
          wallet_address?: string
          writing_style?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_trading_agent_id_fkey"
            columns: ["trading_agent_id"]
            isOneToOne: false
            referencedRelation: "trading_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_request_log: {
        Row: {
          agent_id: string | null
          created_at: string
          error_code: number | null
          id: string
          latency_ms: number | null
          model: string
          request_type: string
          success: boolean
          tokens_input: number | null
          tokens_output: number | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          error_code?: number | null
          id?: string
          latency_ms?: number | null
          model?: string
          request_type: string
          success?: boolean
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          error_code?: number | null
          id?: string
          latency_ms?: number | null
          model?: string
          request_type?: string
          success?: boolean
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_request_log_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      alpha_trades: {
        Row: {
          amount_sol: number
          amount_tokens: number
          chain: string
          created_at: string
          id: string
          price_sol: number | null
          price_usd: number | null
          token_mint: string
          token_name: string | null
          token_ticker: string | null
          trade_type: string
          trader_avatar_url: string | null
          trader_display_name: string | null
          tx_hash: string
          wallet_address: string
        }
        Insert: {
          amount_sol?: number
          amount_tokens?: number
          chain?: string
          created_at?: string
          id?: string
          price_sol?: number | null
          price_usd?: number | null
          token_mint: string
          token_name?: string | null
          token_ticker?: string | null
          trade_type?: string
          trader_avatar_url?: string | null
          trader_display_name?: string | null
          tx_hash: string
          wallet_address: string
        }
        Update: {
          amount_sol?: number
          amount_tokens?: number
          chain?: string
          created_at?: string
          id?: string
          price_sol?: number | null
          price_usd?: number | null
          token_mint?: string
          token_name?: string | null
          token_ticker?: string | null
          trade_type?: string
          trader_avatar_url?: string | null
          trader_display_name?: string | null
          tx_hash?: string
          wallet_address?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          action_label: string | null
          action_url: string | null
          created_at: string
          description: string | null
          emoji: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          title: string
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          title: string
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          title?: string
        }
        Relationships: []
      }
      api_accounts: {
        Row: {
          api_key_hash: string
          api_key_prefix: string
          created_at: string | null
          fee_wallet_address: string
          id: string
          status: string
          terms_accepted_at: string | null
          total_fees_earned: number | null
          total_fees_paid_out: number | null
          updated_at: string | null
          wallet_address: string
        }
        Insert: {
          api_key_hash: string
          api_key_prefix: string
          created_at?: string | null
          fee_wallet_address: string
          id?: string
          status?: string
          terms_accepted_at?: string | null
          total_fees_earned?: number | null
          total_fees_paid_out?: number | null
          updated_at?: string | null
          wallet_address: string
        }
        Update: {
          api_key_hash?: string
          api_key_prefix?: string
          created_at?: string | null
          fee_wallet_address?: string
          id?: string
          status?: string
          terms_accepted_at?: string | null
          total_fees_earned?: number | null
          total_fees_paid_out?: number | null
          updated_at?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      api_fee_distributions: {
        Row: {
          api_account_id: string
          api_user_share: number
          created_at: string | null
          distributed_at: string | null
          id: string
          launchpad_id: string | null
          platform_share: number
          signature: string | null
          status: string
          token_id: string | null
          total_fee_sol: number
        }
        Insert: {
          api_account_id: string
          api_user_share?: number
          created_at?: string | null
          distributed_at?: string | null
          id?: string
          launchpad_id?: string | null
          platform_share?: number
          signature?: string | null
          status?: string
          token_id?: string | null
          total_fee_sol?: number
        }
        Update: {
          api_account_id?: string
          api_user_share?: number
          created_at?: string | null
          distributed_at?: string | null
          id?: string
          launchpad_id?: string | null
          platform_share?: number
          signature?: string | null
          status?: string
          token_id?: string | null
          total_fee_sol?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_fee_distributions_api_account_id_fkey"
            columns: ["api_account_id"]
            isOneToOne: false
            referencedRelation: "api_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_fee_distributions_launchpad_id_fkey"
            columns: ["launchpad_id"]
            isOneToOne: false
            referencedRelation: "api_launchpads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_fee_distributions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      api_launchpad_tokens: {
        Row: {
          created_at: string | null
          id: string
          launchpad_id: string
          token_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          launchpad_id: string
          token_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          launchpad_id?: string
          token_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_launchpad_tokens_launchpad_id_fkey"
            columns: ["launchpad_id"]
            isOneToOne: false
            referencedRelation: "api_launchpads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_launchpad_tokens_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      api_launchpads: {
        Row: {
          api_account_id: string
          cloudflare_record_id: string | null
          created_at: string | null
          custom_domain: string | null
          deployed_at: string | null
          design_config: Json | null
          id: string
          name: string
          status: string
          subdomain: string | null
          total_fees_sol: number | null
          total_volume_sol: number | null
          updated_at: string | null
          vercel_deployment_url: string | null
          vercel_project_id: string | null
        }
        Insert: {
          api_account_id: string
          cloudflare_record_id?: string | null
          created_at?: string | null
          custom_domain?: string | null
          deployed_at?: string | null
          design_config?: Json | null
          id?: string
          name: string
          status?: string
          subdomain?: string | null
          total_fees_sol?: number | null
          total_volume_sol?: number | null
          updated_at?: string | null
          vercel_deployment_url?: string | null
          vercel_project_id?: string | null
        }
        Update: {
          api_account_id?: string
          cloudflare_record_id?: string | null
          created_at?: string | null
          custom_domain?: string | null
          deployed_at?: string | null
          design_config?: Json | null
          id?: string
          name?: string
          status?: string
          subdomain?: string | null
          total_fees_sol?: number | null
          total_volume_sol?: number | null
          updated_at?: string | null
          vercel_deployment_url?: string | null
          vercel_project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_launchpads_api_account_id_fkey"
            columns: ["api_account_id"]
            isOneToOne: false
            referencedRelation: "api_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage_logs: {
        Row: {
          api_account_id: string
          created_at: string | null
          endpoint: string
          id: string
          method: string
          response_time_ms: number | null
          status_code: number | null
        }
        Insert: {
          api_account_id: string
          created_at?: string | null
          endpoint: string
          id?: string
          method?: string
          response_time_ms?: number | null
          status_code?: number | null
        }
        Update: {
          api_account_id?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          method?: string
          response_time_ms?: number | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_logs_api_account_id_fkey"
            columns: ["api_account_id"]
            isOneToOne: false
            referencedRelation: "api_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      api_webhooks: {
        Row: {
          api_account_id: string
          created_at: string | null
          events: string[]
          failure_count: number | null
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          secret: string
          updated_at: string | null
          url: string
        }
        Insert: {
          api_account_id: string
          created_at?: string | null
          events?: string[]
          failure_count?: number | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          secret: string
          updated_at?: string | null
          url: string
        }
        Update: {
          api_account_id?: string
          created_at?: string | null
          events?: string[]
          failure_count?: number | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          secret?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_webhooks_api_account_id_fkey"
            columns: ["api_account_id"]
            isOneToOne: false
            referencedRelation: "api_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bags_fee_claims: {
        Row: {
          claimed_sol: number
          created_at: string | null
          distributed: boolean | null
          fun_token_id: string | null
          id: string
          mint_address: string
          signature: string | null
        }
        Insert: {
          claimed_sol?: number
          created_at?: string | null
          distributed?: boolean | null
          fun_token_id?: string | null
          id?: string
          mint_address: string
          signature?: string | null
        }
        Update: {
          claimed_sol?: number
          created_at?: string | null
          distributed?: boolean | null
          fun_token_id?: string | null
          id?: string
          mint_address?: string
          signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bags_fee_claims_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      base_buybacks: {
        Row: {
          created_at: string | null
          eth_amount: number
          fun_token_id: string | null
          id: string
          tokens_bought: number | null
          tx_hash: string | null
        }
        Insert: {
          created_at?: string | null
          eth_amount: number
          fun_token_id?: string | null
          id?: string
          tokens_bought?: number | null
          tx_hash?: string | null
        }
        Update: {
          created_at?: string | null
          eth_amount?: number
          fun_token_id?: string | null
          id?: string
          tokens_bought?: number | null
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "base_buybacks_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      base_creator_claims: {
        Row: {
          claimed_at: string | null
          claimed_eth: number
          created_at: string | null
          creator_wallet: string
          fun_token_id: string | null
          id: string
          tx_hash: string | null
        }
        Insert: {
          claimed_at?: string | null
          claimed_eth?: number
          created_at?: string | null
          creator_wallet: string
          fun_token_id?: string | null
          id?: string
          tx_hash?: string | null
        }
        Update: {
          claimed_at?: string | null
          claimed_eth?: number
          created_at?: string | null
          creator_wallet?: string
          fun_token_id?: string | null
          id?: string
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "base_creator_claims_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      base_deployments: {
        Row: {
          contracts: Json
          created_at: string
          deployed_at: string
          deployer: string
          id: string
          is_active: boolean
          network: string
          tx_hashes: string[]
        }
        Insert: {
          contracts: Json
          created_at?: string
          deployed_at?: string
          deployer: string
          id?: string
          is_active?: boolean
          network: string
          tx_hashes: string[]
        }
        Update: {
          contracts?: Json
          created_at?: string
          deployed_at?: string
          deployer?: string
          id?: string
          is_active?: boolean
          network?: string
          tx_hashes?: string[]
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      branding_config: {
        Row: {
          agent_brand_name: string | null
          app_url: string | null
          brand_name: string
          brand_short_name: string
          color_accent: string | null
          color_background: string | null
          color_foreground: string | null
          color_muted: string | null
          color_primary: string | null
          community_prefix: string | null
          created_at: string
          description: string | null
          discord_url: string | null
          domain: string | null
          favicon_url: string | null
          feature_agents_enabled: boolean | null
          feature_alpha_tracker_enabled: boolean | null
          feature_forum_enabled: boolean | null
          feature_governance_enabled: boolean | null
          feature_leverage_enabled: boolean | null
          feature_merch_enabled: boolean | null
          feature_x_tracker_enabled: boolean | null
          font_family: string | null
          forum_name: string | null
          icon_emoji: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          meta_description: string | null
          og_image_url: string | null
          page_title: string | null
          platform_token_mint: string | null
          platform_token_name: string | null
          platform_token_ticker: string | null
          sdk_name: string | null
          tagline: string | null
          telegram_url: string | null
          twitter_handle: string | null
          twitter_url: string | null
          updated_at: string
        }
        Insert: {
          agent_brand_name?: string | null
          app_url?: string | null
          brand_name?: string
          brand_short_name?: string
          color_accent?: string | null
          color_background?: string | null
          color_foreground?: string | null
          color_muted?: string | null
          color_primary?: string | null
          community_prefix?: string | null
          created_at?: string
          description?: string | null
          discord_url?: string | null
          domain?: string | null
          favicon_url?: string | null
          feature_agents_enabled?: boolean | null
          feature_alpha_tracker_enabled?: boolean | null
          feature_forum_enabled?: boolean | null
          feature_governance_enabled?: boolean | null
          feature_leverage_enabled?: boolean | null
          feature_merch_enabled?: boolean | null
          feature_x_tracker_enabled?: boolean | null
          font_family?: string | null
          forum_name?: string | null
          icon_emoji?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          meta_description?: string | null
          og_image_url?: string | null
          page_title?: string | null
          platform_token_mint?: string | null
          platform_token_name?: string | null
          platform_token_ticker?: string | null
          sdk_name?: string | null
          tagline?: string | null
          telegram_url?: string | null
          twitter_handle?: string | null
          twitter_url?: string | null
          updated_at?: string
        }
        Update: {
          agent_brand_name?: string | null
          app_url?: string | null
          brand_name?: string
          brand_short_name?: string
          color_accent?: string | null
          color_background?: string | null
          color_foreground?: string | null
          color_muted?: string | null
          color_primary?: string | null
          community_prefix?: string | null
          created_at?: string
          description?: string | null
          discord_url?: string | null
          domain?: string | null
          favicon_url?: string | null
          feature_agents_enabled?: boolean | null
          feature_alpha_tracker_enabled?: boolean | null
          feature_forum_enabled?: boolean | null
          feature_governance_enabled?: boolean | null
          feature_leverage_enabled?: boolean | null
          feature_merch_enabled?: boolean | null
          feature_x_tracker_enabled?: boolean | null
          font_family?: string | null
          forum_name?: string | null
          icon_emoji?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          meta_description?: string | null
          og_image_url?: string | null
          page_title?: string | null
          platform_token_mint?: string | null
          platform_token_name?: string | null
          platform_token_ticker?: string | null
          sdk_name?: string | null
          tagline?: string | null
          telegram_url?: string | null
          twitter_handle?: string | null
          twitter_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      claw_agent_bids: {
        Row: {
          bid_amount_sol: number
          bidder_wallet: string
          claw_agent_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          refund_signature: string | null
          refunded_at: string | null
          status: string
          trading_agent_id: string | null
          tx_signature: string | null
        }
        Insert: {
          bid_amount_sol: number
          bidder_wallet: string
          claw_agent_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          refund_signature?: string | null
          refunded_at?: string | null
          status?: string
          trading_agent_id?: string | null
          tx_signature?: string | null
        }
        Update: {
          bid_amount_sol?: number
          bidder_wallet?: string
          claw_agent_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          refund_signature?: string | null
          refunded_at?: string | null
          status?: string
          trading_agent_id?: string | null
          tx_signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claw_agent_bids_claw_agent_id_fkey"
            columns: ["claw_agent_id"]
            isOneToOne: false
            referencedRelation: "claw_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claw_agent_bids_trading_agent_id_fkey"
            columns: ["trading_agent_id"]
            isOneToOne: false
            referencedRelation: "claw_trading_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      claw_agent_fee_distributions: {
        Row: {
          agent_id: string
          amount_sol: number
          completed_at: string | null
          created_at: string | null
          fun_token_id: string
          id: string
          signature: string | null
          status: string | null
        }
        Insert: {
          agent_id: string
          amount_sol: number
          completed_at?: string | null
          created_at?: string | null
          fun_token_id: string
          id?: string
          signature?: string | null
          status?: string | null
        }
        Update: {
          agent_id?: string
          amount_sol?: number
          completed_at?: string | null
          created_at?: string | null
          fun_token_id?: string
          id?: string
          signature?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claw_agent_fee_distributions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "claw_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claw_agent_fee_distributions_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "claw_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      claw_agent_tokens: {
        Row: {
          agent_id: string
          created_at: string | null
          fun_token_id: string
          id: string
          source_platform: string | null
          source_post_id: string | null
          source_post_url: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          fun_token_id: string
          id?: string
          source_platform?: string | null
          source_post_id?: string | null
          source_post_url?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          fun_token_id?: string
          id?: string
          source_platform?: string | null
          source_post_id?: string | null
          source_post_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claw_agent_tokens_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "claw_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claw_agent_tokens_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "claw_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      claw_agents: {
        Row: {
          api_key_hash: string
          api_key_prefix: string
          avatar_url: string | null
          comment_count: number | null
          created_at: string | null
          description: string | null
          has_posted_welcome: boolean | null
          id: string
          karma: number | null
          last_auto_engage_at: string | null
          last_cross_visit_at: string | null
          last_launch_at: string | null
          last_social_activity_at: string | null
          launches_today: number | null
          name: string
          post_count: number | null
          status: string | null
          style_learned_at: string | null
          style_source_twitter_url: string | null
          style_source_username: string | null
          total_fees_claimed_sol: number | null
          total_fees_earned_sol: number | null
          total_tokens_launched: number | null
          trading_agent_id: string | null
          twitter_handle: string | null
          updated_at: string | null
          verified_at: string | null
          wallet_address: string
          writing_style: Json | null
        }
        Insert: {
          api_key_hash: string
          api_key_prefix: string
          avatar_url?: string | null
          comment_count?: number | null
          created_at?: string | null
          description?: string | null
          has_posted_welcome?: boolean | null
          id?: string
          karma?: number | null
          last_auto_engage_at?: string | null
          last_cross_visit_at?: string | null
          last_launch_at?: string | null
          last_social_activity_at?: string | null
          launches_today?: number | null
          name: string
          post_count?: number | null
          status?: string | null
          style_learned_at?: string | null
          style_source_twitter_url?: string | null
          style_source_username?: string | null
          total_fees_claimed_sol?: number | null
          total_fees_earned_sol?: number | null
          total_tokens_launched?: number | null
          trading_agent_id?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
          verified_at?: string | null
          wallet_address: string
          writing_style?: Json | null
        }
        Update: {
          api_key_hash?: string
          api_key_prefix?: string
          avatar_url?: string | null
          comment_count?: number | null
          created_at?: string | null
          description?: string | null
          has_posted_welcome?: boolean | null
          id?: string
          karma?: number | null
          last_auto_engage_at?: string | null
          last_cross_visit_at?: string | null
          last_launch_at?: string | null
          last_social_activity_at?: string | null
          launches_today?: number | null
          name?: string
          post_count?: number | null
          status?: string | null
          style_learned_at?: string | null
          style_source_twitter_url?: string | null
          style_source_username?: string | null
          total_fees_claimed_sol?: number | null
          total_fees_earned_sol?: number | null
          total_tokens_launched?: number | null
          trading_agent_id?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
          verified_at?: string | null
          wallet_address?: string
          writing_style?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "claw_agents_trading_agent_id_fkey"
            columns: ["trading_agent_id"]
            isOneToOne: false
            referencedRelation: "claw_trading_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      claw_bribes: {
        Row: {
          bribe_amount_sol: number
          bribe_wallet_address: string
          bribe_wallet_private_key_encrypted: string
          briber_wallet: string
          child_agent_id: string | null
          child_trading_agent_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          parent_agent_id: string
          status: string
          tx_signature: string | null
        }
        Insert: {
          bribe_amount_sol?: number
          bribe_wallet_address: string
          bribe_wallet_private_key_encrypted: string
          briber_wallet: string
          child_agent_id?: string | null
          child_trading_agent_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          parent_agent_id: string
          status?: string
          tx_signature?: string | null
        }
        Update: {
          bribe_amount_sol?: number
          bribe_wallet_address?: string
          bribe_wallet_private_key_encrypted?: string
          briber_wallet?: string
          child_agent_id?: string | null
          child_trading_agent_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          parent_agent_id?: string
          status?: string
          tx_signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claw_bribes_child_agent_id_fkey"
            columns: ["child_agent_id"]
            isOneToOne: false
            referencedRelation: "claw_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claw_bribes_child_trading_agent_id_fkey"
            columns: ["child_trading_agent_id"]
            isOneToOne: false
            referencedRelation: "claw_trading_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claw_bribes_parent_agent_id_fkey"
            columns: ["parent_agent_id"]
            isOneToOne: false
            referencedRelation: "claw_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      claw_comments: {
        Row: {
          author_agent_id: string | null
          author_id: string | null
          content: string
          created_at: string | null
          downvotes: number | null
          id: string
          is_agent_comment: boolean | null
          parent_comment_id: string | null
          post_id: string
          score: number | null
          updated_at: string | null
          upvotes: number | null
        }
        Insert: {
          author_agent_id?: string | null
          author_id?: string | null
          content: string
          created_at?: string | null
          downvotes?: number | null
          id?: string
          is_agent_comment?: boolean | null
          parent_comment_id?: string | null
          post_id: string
          score?: number | null
          updated_at?: string | null
          upvotes?: number | null
        }
        Update: {
          author_agent_id?: string | null
          author_id?: string | null
          content?: string
          created_at?: string | null
          downvotes?: number | null
          id?: string
          is_agent_comment?: boolean | null
          parent_comment_id?: string | null
          post_id?: string
          score?: number | null
          updated_at?: string | null
          upvotes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "claw_comments_author_agent_id_fkey"
            columns: ["author_agent_id"]
            isOneToOne: false
            referencedRelation: "claw_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claw_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "claw_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claw_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "claw_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      claw_communities: {
        Row: {
          agent_id: string | null
          banner_url: string | null
          created_at: string | null
          description: string | null
          fun_token_id: string | null
          icon_url: string | null
          id: string
          member_count: number | null
          name: string
          post_count: number | null
          rules: Json | null
          settings: Json | null
          style_source_username: string | null
          ticker: string | null
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          banner_url?: string | null
          created_at?: string | null
          description?: string | null
          fun_token_id?: string | null
          icon_url?: string | null
          id?: string
          member_count?: number | null
          name: string
          post_count?: number | null
          rules?: Json | null
          settings?: Json | null
          style_source_username?: string | null
          ticker?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          banner_url?: string | null
          created_at?: string | null
          description?: string | null
          fun_token_id?: string | null
          icon_url?: string | null
          id?: string
          member_count?: number | null
          name?: string
          post_count?: number | null
          rules?: Json | null
          settings?: Json | null
          style_source_username?: string | null
          ticker?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claw_communities_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "claw_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claw_communities_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: true
            referencedRelation: "claw_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      claw_creator_claim_locks: {
        Row: {
          expires_at: string
          id: string
          locked_at: string
          twitter_username: string
        }
        Insert: {
          expires_at: string
          id?: string
          locked_at?: string
          twitter_username: string
        }
        Update: {
          expires_at?: string
          id?: string
          locked_at?: string
          twitter_username?: string
        }
        Relationships: []
      }
      claw_deployer_wallets: {
        Row: {
          created_at: string | null
          encrypted_private_key: string
          funded_sol: number | null
          id: string
          reclaimed_at: string | null
          remaining_sol: number | null
          token_mint: string | null
          wallet_address: string
        }
        Insert: {
          created_at?: string | null
          encrypted_private_key: string
          funded_sol?: number | null
          id?: string
          reclaimed_at?: string | null
          remaining_sol?: number | null
          token_mint?: string | null
          wallet_address: string
        }
        Update: {
          created_at?: string | null
          encrypted_private_key?: string
          funded_sol?: number | null
          id?: string
          reclaimed_at?: string | null
          remaining_sol?: number | null
          token_mint?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      claw_distributions: {
        Row: {
          amount_sol: number
          created_at: string
          creator_wallet: string | null
          distribution_type: string
          fun_token_id: string | null
          id: string
          signature: string | null
          status: string
          twitter_username: string | null
        }
        Insert: {
          amount_sol?: number
          created_at?: string
          creator_wallet?: string | null
          distribution_type?: string
          fun_token_id?: string | null
          id?: string
          signature?: string | null
          status?: string
          twitter_username?: string | null
        }
        Update: {
          amount_sol?: number
          created_at?: string
          creator_wallet?: string | null
          distribution_type?: string
          fun_token_id?: string | null
          id?: string
          signature?: string | null
          status?: string
          twitter_username?: string | null
        }
        Relationships: []
      }
      claw_fee_claims: {
        Row: {
          claimed_at: string | null
          claimed_sol: number | null
          created_at: string | null
          creator_distributed: boolean | null
          creator_distribution_id: string | null
          fun_token_id: string | null
          id: string
          pool_address: string
          signature: string | null
        }
        Insert: {
          claimed_at?: string | null
          claimed_sol?: number | null
          created_at?: string | null
          creator_distributed?: boolean | null
          creator_distribution_id?: string | null
          fun_token_id?: string | null
          id?: string
          pool_address: string
          signature?: string | null
        }
        Update: {
          claimed_at?: string | null
          claimed_sol?: number | null
          created_at?: string | null
          creator_distributed?: boolean | null
          creator_distribution_id?: string | null
          fun_token_id?: string | null
          id?: string
          pool_address?: string
          signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claw_fee_claims_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "claw_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      claw_posts: {
        Row: {
          author_agent_id: string | null
          author_id: string | null
          comment_count: number | null
          content: string | null
          created_at: string | null
          downvotes: number | null
          guest_downvotes: number | null
          guest_upvotes: number | null
          id: string
          image_url: string | null
          is_agent_post: boolean | null
          is_locked: boolean | null
          is_pinned: boolean | null
          link_url: string | null
          post_type: string | null
          score: number | null
          slug: string | null
          subtuna_id: string
          title: string
          updated_at: string | null
          upvotes: number | null
          x_post_id: string | null
        }
        Insert: {
          author_agent_id?: string | null
          author_id?: string | null
          comment_count?: number | null
          content?: string | null
          created_at?: string | null
          downvotes?: number | null
          guest_downvotes?: number | null
          guest_upvotes?: number | null
          id?: string
          image_url?: string | null
          is_agent_post?: boolean | null
          is_locked?: boolean | null
          is_pinned?: boolean | null
          link_url?: string | null
          post_type?: string | null
          score?: number | null
          slug?: string | null
          subtuna_id: string
          title: string
          updated_at?: string | null
          upvotes?: number | null
          x_post_id?: string | null
        }
        Update: {
          author_agent_id?: string | null
          author_id?: string | null
          comment_count?: number | null
          content?: string | null
          created_at?: string | null
          downvotes?: number | null
          guest_downvotes?: number | null
          guest_upvotes?: number | null
          id?: string
          image_url?: string | null
          is_agent_post?: boolean | null
          is_locked?: boolean | null
          is_pinned?: boolean | null
          link_url?: string | null
          post_type?: string | null
          score?: number | null
          slug?: string | null
          subtuna_id?: string
          title?: string
          updated_at?: string | null
          upvotes?: number | null
          x_post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claw_posts_author_agent_id_fkey"
            columns: ["author_agent_id"]
            isOneToOne: false
            referencedRelation: "claw_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claw_posts_subtuna_id_fkey"
            columns: ["subtuna_id"]
            isOneToOne: false
            referencedRelation: "claw_communities"
            referencedColumns: ["id"]
          },
        ]
      }
      claw_tokens: {
        Row: {
          agent_fee_share_bps: number | null
          agent_id: string | null
          bonding_progress: number | null
          chain: string | null
          created_at: string | null
          creator_fee_bps: number | null
          creator_wallet: string | null
          dbc_pool_address: string | null
          deployer_wallet: string | null
          description: string | null
          discord_url: string | null
          fair_launch_duration_mins: number | null
          fair_launch_ends_at: string | null
          fee_mode: string | null
          holder_count: number | null
          id: string
          image_url: string | null
          is_trading_agent_token: boolean | null
          last_distribution_at: string | null
          launchpad_type: string | null
          market_cap_sol: number | null
          mint_address: string | null
          name: string
          price_24h_ago: number | null
          price_change_24h: number | null
          price_sol: number | null
          starting_mcap_usd: number | null
          status: string | null
          telegram_url: string | null
          ticker: string
          total_fees_claimed: number | null
          total_fees_earned: number | null
          trading_agent_id: string | null
          trading_fee_bps: number | null
          twitter_url: string | null
          updated_at: string | null
          volume_24h_sol: number | null
          website_url: string | null
        }
        Insert: {
          agent_fee_share_bps?: number | null
          agent_id?: string | null
          bonding_progress?: number | null
          chain?: string | null
          created_at?: string | null
          creator_fee_bps?: number | null
          creator_wallet?: string | null
          dbc_pool_address?: string | null
          deployer_wallet?: string | null
          description?: string | null
          discord_url?: string | null
          fair_launch_duration_mins?: number | null
          fair_launch_ends_at?: string | null
          fee_mode?: string | null
          holder_count?: number | null
          id?: string
          image_url?: string | null
          is_trading_agent_token?: boolean | null
          last_distribution_at?: string | null
          launchpad_type?: string | null
          market_cap_sol?: number | null
          mint_address?: string | null
          name: string
          price_24h_ago?: number | null
          price_change_24h?: number | null
          price_sol?: number | null
          starting_mcap_usd?: number | null
          status?: string | null
          telegram_url?: string | null
          ticker: string
          total_fees_claimed?: number | null
          total_fees_earned?: number | null
          trading_agent_id?: string | null
          trading_fee_bps?: number | null
          twitter_url?: string | null
          updated_at?: string | null
          volume_24h_sol?: number | null
          website_url?: string | null
        }
        Update: {
          agent_fee_share_bps?: number | null
          agent_id?: string | null
          bonding_progress?: number | null
          chain?: string | null
          created_at?: string | null
          creator_fee_bps?: number | null
          creator_wallet?: string | null
          dbc_pool_address?: string | null
          deployer_wallet?: string | null
          description?: string | null
          discord_url?: string | null
          fair_launch_duration_mins?: number | null
          fair_launch_ends_at?: string | null
          fee_mode?: string | null
          holder_count?: number | null
          id?: string
          image_url?: string | null
          is_trading_agent_token?: boolean | null
          last_distribution_at?: string | null
          launchpad_type?: string | null
          market_cap_sol?: number | null
          mint_address?: string | null
          name?: string
          price_24h_ago?: number | null
          price_change_24h?: number | null
          price_sol?: number | null
          starting_mcap_usd?: number | null
          status?: string | null
          telegram_url?: string | null
          ticker?: string
          total_fees_claimed?: number | null
          total_fees_earned?: number | null
          trading_agent_id?: string | null
          trading_fee_bps?: number | null
          twitter_url?: string | null
          updated_at?: string | null
          volume_24h_sol?: number | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claw_tokens_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "claw_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claw_tokens_trading_agent_id_fkey"
            columns: ["trading_agent_id"]
            isOneToOne: false
            referencedRelation: "claw_trading_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      claw_trading_agents: {
        Row: {
          agent_id: string | null
          avatar_url: string | null
          avg_hold_time_minutes: number | null
          avoided_patterns: string[] | null
          best_trade_sol: number | null
          bid_wallet_address: string | null
          bid_wallet_private_key_encrypted: string | null
          bidding_ends_at: string | null
          consecutive_losses: number | null
          consecutive_wins: number | null
          created_at: string | null
          creator_profile_id: string | null
          creator_wallet: string | null
          description: string | null
          fun_token_id: string | null
          id: string
          is_owned: boolean | null
          last_deposit_at: string | null
          last_strategy_review: string | null
          last_trade_at: string | null
          launched_at: string | null
          learned_patterns: Json | null
          losing_trades: number | null
          max_concurrent_positions: number | null
          max_position_size_sol: number | null
          mint_address: string | null
          name: string
          owner_wallet: string | null
          ownership_transferred_at: string | null
          preferred_narratives: string[] | null
          status: string | null
          stop_loss_pct: number | null
          strategy_notes: string | null
          strategy_type: string | null
          take_profit_pct: number | null
          ticker: string
          total_invested_sol: number | null
          total_profit_sol: number | null
          total_trades: number | null
          trading_capital_sol: number | null
          trading_style: string | null
          twitter_url: string | null
          unrealized_pnl_sol: number | null
          updated_at: string | null
          wallet_address: string
          wallet_private_key_encrypted: string
          win_rate: number | null
          winning_trades: number | null
          worst_trade_sol: number | null
        }
        Insert: {
          agent_id?: string | null
          avatar_url?: string | null
          avg_hold_time_minutes?: number | null
          avoided_patterns?: string[] | null
          best_trade_sol?: number | null
          bid_wallet_address?: string | null
          bid_wallet_private_key_encrypted?: string | null
          bidding_ends_at?: string | null
          consecutive_losses?: number | null
          consecutive_wins?: number | null
          created_at?: string | null
          creator_profile_id?: string | null
          creator_wallet?: string | null
          description?: string | null
          fun_token_id?: string | null
          id?: string
          is_owned?: boolean | null
          last_deposit_at?: string | null
          last_strategy_review?: string | null
          last_trade_at?: string | null
          launched_at?: string | null
          learned_patterns?: Json | null
          losing_trades?: number | null
          max_concurrent_positions?: number | null
          max_position_size_sol?: number | null
          mint_address?: string | null
          name: string
          owner_wallet?: string | null
          ownership_transferred_at?: string | null
          preferred_narratives?: string[] | null
          status?: string | null
          stop_loss_pct?: number | null
          strategy_notes?: string | null
          strategy_type?: string | null
          take_profit_pct?: number | null
          ticker: string
          total_invested_sol?: number | null
          total_profit_sol?: number | null
          total_trades?: number | null
          trading_capital_sol?: number | null
          trading_style?: string | null
          twitter_url?: string | null
          unrealized_pnl_sol?: number | null
          updated_at?: string | null
          wallet_address: string
          wallet_private_key_encrypted: string
          win_rate?: number | null
          winning_trades?: number | null
          worst_trade_sol?: number | null
        }
        Update: {
          agent_id?: string | null
          avatar_url?: string | null
          avg_hold_time_minutes?: number | null
          avoided_patterns?: string[] | null
          best_trade_sol?: number | null
          bid_wallet_address?: string | null
          bid_wallet_private_key_encrypted?: string | null
          bidding_ends_at?: string | null
          consecutive_losses?: number | null
          consecutive_wins?: number | null
          created_at?: string | null
          creator_profile_id?: string | null
          creator_wallet?: string | null
          description?: string | null
          fun_token_id?: string | null
          id?: string
          is_owned?: boolean | null
          last_deposit_at?: string | null
          last_strategy_review?: string | null
          last_trade_at?: string | null
          launched_at?: string | null
          learned_patterns?: Json | null
          losing_trades?: number | null
          max_concurrent_positions?: number | null
          max_position_size_sol?: number | null
          mint_address?: string | null
          name?: string
          owner_wallet?: string | null
          ownership_transferred_at?: string | null
          preferred_narratives?: string[] | null
          status?: string | null
          stop_loss_pct?: number | null
          strategy_notes?: string | null
          strategy_type?: string | null
          take_profit_pct?: number | null
          ticker?: string
          total_invested_sol?: number | null
          total_profit_sol?: number | null
          total_trades?: number | null
          trading_capital_sol?: number | null
          trading_style?: string | null
          twitter_url?: string | null
          unrealized_pnl_sol?: number | null
          updated_at?: string | null
          wallet_address?: string
          wallet_private_key_encrypted?: string
          win_rate?: number | null
          winning_trades?: number | null
          worst_trade_sol?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "claw_trading_agents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "claw_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claw_trading_agents_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "claw_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      claw_trading_fee_deposits: {
        Row: {
          amount_sol: number
          created_at: string | null
          id: string
          signature: string | null
          source: string | null
          trading_agent_id: string
        }
        Insert: {
          amount_sol: number
          created_at?: string | null
          id?: string
          signature?: string | null
          source?: string | null
          trading_agent_id: string
        }
        Update: {
          amount_sol?: number
          created_at?: string | null
          id?: string
          signature?: string | null
          source?: string | null
          trading_agent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claw_trading_fee_deposits_trading_agent_id_fkey"
            columns: ["trading_agent_id"]
            isOneToOne: false
            referencedRelation: "claw_trading_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      claw_trading_positions: {
        Row: {
          amount_tokens: number
          closed_at: string | null
          current_price_sol: number | null
          current_value_sol: number | null
          entry_narrative: string | null
          entry_price_sol: number
          entry_reason: string | null
          exit_reason: string | null
          id: string
          investment_sol: number
          limit_order_sl_pubkey: string | null
          limit_order_sl_status: string | null
          limit_order_tp_pubkey: string | null
          limit_order_tp_status: string | null
          market_conditions: string | null
          opened_at: string | null
          realized_pnl_sol: number | null
          risk_assessment: string | null
          status: string | null
          stop_loss_price_sol: number | null
          strategy_adjustments: string | null
          target_price_sol: number | null
          token_address: string
          token_image_url: string | null
          token_name: string | null
          token_symbol: string | null
          trading_agent_id: string
          trailing_stop_active: boolean | null
          unrealized_pnl_pct: number | null
          unrealized_pnl_sol: number | null
        }
        Insert: {
          amount_tokens: number
          closed_at?: string | null
          current_price_sol?: number | null
          current_value_sol?: number | null
          entry_narrative?: string | null
          entry_price_sol: number
          entry_reason?: string | null
          exit_reason?: string | null
          id?: string
          investment_sol: number
          limit_order_sl_pubkey?: string | null
          limit_order_sl_status?: string | null
          limit_order_tp_pubkey?: string | null
          limit_order_tp_status?: string | null
          market_conditions?: string | null
          opened_at?: string | null
          realized_pnl_sol?: number | null
          risk_assessment?: string | null
          status?: string | null
          stop_loss_price_sol?: number | null
          strategy_adjustments?: string | null
          target_price_sol?: number | null
          token_address: string
          token_image_url?: string | null
          token_name?: string | null
          token_symbol?: string | null
          trading_agent_id: string
          trailing_stop_active?: boolean | null
          unrealized_pnl_pct?: number | null
          unrealized_pnl_sol?: number | null
        }
        Update: {
          amount_tokens?: number
          closed_at?: string | null
          current_price_sol?: number | null
          current_value_sol?: number | null
          entry_narrative?: string | null
          entry_price_sol?: number
          entry_reason?: string | null
          exit_reason?: string | null
          id?: string
          investment_sol?: number
          limit_order_sl_pubkey?: string | null
          limit_order_sl_status?: string | null
          limit_order_tp_pubkey?: string | null
          limit_order_tp_status?: string | null
          market_conditions?: string | null
          opened_at?: string | null
          realized_pnl_sol?: number | null
          risk_assessment?: string | null
          status?: string | null
          stop_loss_price_sol?: number | null
          strategy_adjustments?: string | null
          target_price_sol?: number | null
          token_address?: string
          token_image_url?: string | null
          token_name?: string | null
          token_symbol?: string | null
          trading_agent_id?: string
          trailing_stop_active?: boolean | null
          unrealized_pnl_pct?: number | null
          unrealized_pnl_sol?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "claw_trading_positions_trading_agent_id_fkey"
            columns: ["trading_agent_id"]
            isOneToOne: false
            referencedRelation: "claw_trading_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      claw_trading_strategy_reviews: {
        Row: {
          confidence_level: number | null
          created_at: string | null
          deprecated_rules: string[] | null
          id: string
          key_insights: string | null
          new_rules: string[] | null
          review_type: string | null
          strategy_adjustments: string | null
          total_pnl_at_review: number | null
          trades_analyzed: number | null
          trading_agent_id: string
          win_rate_at_review: number | null
        }
        Insert: {
          confidence_level?: number | null
          created_at?: string | null
          deprecated_rules?: string[] | null
          id?: string
          key_insights?: string | null
          new_rules?: string[] | null
          review_type?: string | null
          strategy_adjustments?: string | null
          total_pnl_at_review?: number | null
          trades_analyzed?: number | null
          trading_agent_id: string
          win_rate_at_review?: number | null
        }
        Update: {
          confidence_level?: number | null
          created_at?: string | null
          deprecated_rules?: string[] | null
          id?: string
          key_insights?: string | null
          new_rules?: string[] | null
          review_type?: string | null
          strategy_adjustments?: string | null
          total_pnl_at_review?: number | null
          trades_analyzed?: number | null
          trading_agent_id?: string
          win_rate_at_review?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "claw_trading_strategy_reviews_trading_agent_id_fkey"
            columns: ["trading_agent_id"]
            isOneToOne: false
            referencedRelation: "claw_trading_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      claw_trading_trades: {
        Row: {
          ai_reasoning: string | null
          amount_sol: number
          amount_tokens: number
          buy_signature: string | null
          confidence_score: number | null
          created_at: string | null
          entry_analysis: string | null
          error_message: string | null
          execution_time_ms: number | null
          exit_analysis: string | null
          id: string
          lessons_learned: string | null
          market_context: string | null
          narrative_match: string | null
          position_id: string | null
          price_per_token: number
          signature: string | null
          slippage_actual: number | null
          status: string | null
          strategy_used: string | null
          subtuna_post_id: string | null
          token_address: string
          token_name: string | null
          token_score: number | null
          trade_type: string
          trading_agent_id: string
          verified_at: string | null
          verified_pnl_sol: number | null
        }
        Insert: {
          ai_reasoning?: string | null
          amount_sol: number
          amount_tokens: number
          buy_signature?: string | null
          confidence_score?: number | null
          created_at?: string | null
          entry_analysis?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          exit_analysis?: string | null
          id?: string
          lessons_learned?: string | null
          market_context?: string | null
          narrative_match?: string | null
          position_id?: string | null
          price_per_token: number
          signature?: string | null
          slippage_actual?: number | null
          status?: string | null
          strategy_used?: string | null
          subtuna_post_id?: string | null
          token_address: string
          token_name?: string | null
          token_score?: number | null
          trade_type: string
          trading_agent_id: string
          verified_at?: string | null
          verified_pnl_sol?: number | null
        }
        Update: {
          ai_reasoning?: string | null
          amount_sol?: number
          amount_tokens?: number
          buy_signature?: string | null
          confidence_score?: number | null
          created_at?: string | null
          entry_analysis?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          exit_analysis?: string | null
          id?: string
          lessons_learned?: string | null
          market_context?: string | null
          narrative_match?: string | null
          position_id?: string | null
          price_per_token?: number
          signature?: string | null
          slippage_actual?: number | null
          status?: string | null
          strategy_used?: string | null
          subtuna_post_id?: string | null
          token_address?: string
          token_name?: string | null
          token_score?: number | null
          trade_type?: string
          trading_agent_id?: string
          verified_at?: string | null
          verified_pnl_sol?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "claw_trading_trades_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "claw_trading_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claw_trading_trades_trading_agent_id_fkey"
            columns: ["trading_agent_id"]
            isOneToOne: false
            referencedRelation: "claw_trading_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      claw_votes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
          vote_type: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
          vote_type: number
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
          vote_type?: number
        }
        Relationships: [
          {
            foreignKeyName: "claw_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "claw_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      colosseum_activity: {
        Row: {
          activity_type: string
          created_at: string | null
          error_message: string | null
          id: string
          payload: Json | null
          response: Json | null
          success: boolean | null
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          response?: Json | null
          success?: boolean | null
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          response?: Json | null
          success?: boolean | null
        }
        Relationships: []
      }
      colosseum_engagement_log: {
        Row: {
          comment_body: string | null
          comment_id: string | null
          created_at: string | null
          engagement_type: string
          error_message: string | null
          http_status: number | null
          id: string
          parent_post_id: string | null
          response_body: string | null
          status: string
          target_post_id: string
          target_project_name: string | null
          target_project_slug: string | null
        }
        Insert: {
          comment_body?: string | null
          comment_id?: string | null
          created_at?: string | null
          engagement_type?: string
          error_message?: string | null
          http_status?: number | null
          id?: string
          parent_post_id?: string | null
          response_body?: string | null
          status?: string
          target_post_id: string
          target_project_name?: string | null
          target_project_slug?: string | null
        }
        Update: {
          comment_body?: string | null
          comment_id?: string | null
          created_at?: string | null
          engagement_type?: string
          error_message?: string | null
          http_status?: number | null
          id?: string
          parent_post_id?: string | null
          response_body?: string | null
          status?: string
          target_post_id?: string
          target_project_name?: string | null
          target_project_slug?: string | null
        }
        Relationships: []
      }
      colosseum_forum_comments: {
        Row: {
          body: string
          colosseum_comment_id: string | null
          id: string
          posted_at: string | null
          target_post_id: string
          target_project_name: string | null
        }
        Insert: {
          body: string
          colosseum_comment_id?: string | null
          id?: string
          posted_at?: string | null
          target_post_id: string
          target_project_name?: string | null
        }
        Update: {
          body?: string
          colosseum_comment_id?: string | null
          id?: string
          posted_at?: string | null
          target_post_id?: string
          target_project_name?: string | null
        }
        Relationships: []
      }
      colosseum_forum_posts: {
        Row: {
          body: string | null
          colosseum_post_id: string | null
          comments_count: number | null
          id: string
          last_synced_at: string | null
          post_type: string
          posted_at: string | null
          tags: string[] | null
          title: string | null
          upvotes: number | null
        }
        Insert: {
          body?: string | null
          colosseum_post_id?: string | null
          comments_count?: number | null
          id?: string
          last_synced_at?: string | null
          post_type?: string
          posted_at?: string | null
          tags?: string[] | null
          title?: string | null
          upvotes?: number | null
        }
        Update: {
          body?: string | null
          colosseum_post_id?: string | null
          comments_count?: number | null
          id?: string
          last_synced_at?: string | null
          post_type?: string
          posted_at?: string | null
          tags?: string[] | null
          title?: string | null
          upvotes?: number | null
        }
        Relationships: []
      }
      colosseum_registrations: {
        Row: {
          agent_id: string
          agent_name: string
          api_key_encrypted: string
          claim_code: string | null
          id: string
          registered_at: string | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          agent_name?: string
          api_key_encrypted: string
          claim_code?: string | null
          id?: string
          registered_at?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          agent_name?: string
          api_key_encrypted?: string
          claim_code?: string | null
          id?: string
          registered_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      communities: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          members_count: number | null
          name: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          members_count?: number | null
          name: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          members_count?: number | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_members: {
        Row: {
          community_id: string
          id: string
          joined_at: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          community_id: string
          id?: string
          joined_at?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          community_id?: string
          id?: string
          joined_at?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      console_messages: {
        Row: {
          content: string
          created_at: string
          display_name: string
          id: string
          is_bot: boolean | null
          user_id: string | null
          wallet_address: string | null
        }
        Insert: {
          content: string
          created_at?: string
          display_name: string
          id?: string
          is_bot?: boolean | null
          user_id?: string | null
          wallet_address?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          display_name?: string
          id?: string
          is_bot?: boolean | null
          user_id?: string | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "console_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      console_tips: {
        Row: {
          amount_sol: number
          created_at: string
          id: string
          message_id: string | null
          recipient_display_name: string
          recipient_wallet: string
          signature: string
          treasury_balance_before: number | null
        }
        Insert: {
          amount_sol: number
          created_at?: string
          id?: string
          message_id?: string | null
          recipient_display_name: string
          recipient_wallet: string
          signature: string
          treasury_balance_before?: number | null
        }
        Update: {
          amount_sol?: number
          created_at?: string
          id?: string
          message_id?: string | null
          recipient_display_name?: string
          recipient_wallet?: string
          signature?: string
          treasury_balance_before?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "console_tips_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "console_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          participant_1: string
          participant_2: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          participant_1: string
          participant_2: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          participant_1?: string
          participant_2?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_participant_1_fkey"
            columns: ["participant_1"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_2_fkey"
            columns: ["participant_2"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      copy_trade_executions: {
        Row: {
          created_at: string
          error_message: string | null
          executed_at: string | null
          id: string
          signature: string | null
          sol_amount: number
          status: string
          token_amount: number
          tracked_wallet_id: string
          user_profile_id: string
          user_wallet: string
          wallet_trade_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          signature?: string | null
          sol_amount: number
          status?: string
          token_amount: number
          tracked_wallet_id: string
          user_profile_id: string
          user_wallet: string
          wallet_trade_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          signature?: string | null
          sol_amount?: number
          status?: string
          token_amount?: number
          tracked_wallet_id?: string
          user_profile_id?: string
          user_wallet?: string
          wallet_trade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copy_trade_executions_tracked_wallet_id_fkey"
            columns: ["tracked_wallet_id"]
            isOneToOne: false
            referencedRelation: "tracked_wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copy_trade_executions_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copy_trade_executions_wallet_trade_id_fkey"
            columns: ["wallet_trade_id"]
            isOneToOne: false
            referencedRelation: "wallet_trades"
            referencedColumns: ["id"]
          },
        ]
      }
      countdown_timers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          target_time: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          target_time: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          target_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      creator_claim_locks: {
        Row: {
          expires_at: string
          locked_at: string
          twitter_username: string
        }
        Insert: {
          expires_at: string
          locked_at?: string
          twitter_username: string
        }
        Update: {
          expires_at?: string
          locked_at?: string
          twitter_username?: string
        }
        Relationships: []
      }
      creator_fee_ledger: {
        Row: {
          created_at: string | null
          creator_fee_bps: number
          creator_share_sol: number
          distribution_signature: string | null
          fee_claim_id: string | null
          fee_claim_table: string
          fun_token_id: string
          id: string
          platform_share_sol: number
          status: string
          total_claimed_sol: number
          trading_fee_bps: number
        }
        Insert: {
          created_at?: string | null
          creator_fee_bps: number
          creator_share_sol: number
          distribution_signature?: string | null
          fee_claim_id?: string | null
          fee_claim_table?: string
          fun_token_id: string
          id?: string
          platform_share_sol: number
          status?: string
          total_claimed_sol: number
          trading_fee_bps: number
        }
        Update: {
          created_at?: string | null
          creator_fee_bps?: number
          creator_share_sol?: number
          distribution_signature?: string | null
          fee_claim_id?: string | null
          fee_claim_table?: string
          fun_token_id?: string
          id?: string
          platform_share_sol?: number
          status?: string
          total_claimed_sol?: number
          trading_fee_bps?: number
        }
        Relationships: []
      }
      cron_locks: {
        Row: {
          acquired_at: string
          expires_at: string
          lock_name: string
        }
        Insert: {
          acquired_at?: string
          expires_at: string
          lock_name: string
        }
        Update: {
          acquired_at?: string
          expires_at?: string
          lock_name?: string
        }
        Relationships: []
      }
      dca_orders: {
        Row: {
          amount_per_order: number
          created_at: string
          id: string
          interval_seconds: number
          next_execution_at: string | null
          orders_executed: number
          profile_id: string | null
          side: string
          slippage_bps: number | null
          status: string
          token_id: string
          total_orders: number
          updated_at: string
          user_wallet: string
        }
        Insert: {
          amount_per_order: number
          created_at?: string
          id?: string
          interval_seconds: number
          next_execution_at?: string | null
          orders_executed?: number
          profile_id?: string | null
          side: string
          slippage_bps?: number | null
          status?: string
          token_id: string
          total_orders: number
          updated_at?: string
          user_wallet: string
        }
        Update: {
          amount_per_order?: number
          created_at?: string
          id?: string
          interval_seconds?: number
          next_execution_at?: string | null
          orders_executed?: number
          profile_id?: string | null
          side?: string
          slippage_bps?: number | null
          status?: string
          token_id?: string
          total_orders?: number
          updated_at?: string
          user_wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "dca_orders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dca_orders_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      debug_logs: {
        Row: {
          client_ip: string | null
          created_at: string | null
          id: string
          logs: Json
          session_id: string
        }
        Insert: {
          client_ip?: string | null
          created_at?: string | null
          id?: string
          logs: Json
          session_id: string
        }
        Update: {
          client_ip?: string | null
          created_at?: string | null
          id?: string
          logs?: Json
          session_id?: string
        }
        Relationships: []
      }
      deployer_wallets: {
        Row: {
          created_at: string | null
          encrypted_private_key: string
          funded_sol: number | null
          id: string
          reclaimed_at: string | null
          remaining_sol: number | null
          token_mint: string | null
          wallet_address: string
        }
        Insert: {
          created_at?: string | null
          encrypted_private_key: string
          funded_sol?: number | null
          id?: string
          reclaimed_at?: string | null
          remaining_sol?: number | null
          token_mint?: string | null
          wallet_address: string
        }
        Update: {
          created_at?: string | null
          encrypted_private_key?: string
          funded_sol?: number | null
          id?: string
          reclaimed_at?: string | null
          remaining_sol?: number | null
          token_mint?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      fee_claims: {
        Row: {
          amount_sol: number
          created_at: string | null
          fee_earner_id: string
          id: string
          signature: string
        }
        Insert: {
          amount_sol: number
          created_at?: string | null
          fee_earner_id: string
          id?: string
          signature: string
        }
        Update: {
          amount_sol?: number
          created_at?: string | null
          fee_earner_id?: string
          id?: string
          signature?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_claims_fee_earner_id_fkey"
            columns: ["fee_earner_id"]
            isOneToOne: false
            referencedRelation: "fee_earners"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_earners: {
        Row: {
          created_at: string | null
          earner_type: string
          id: string
          last_claimed_at: string | null
          profile_id: string | null
          share_bps: number
          token_id: string
          total_earned_sol: number | null
          twitter_handle: string | null
          unclaimed_sol: number | null
          wallet_address: string | null
        }
        Insert: {
          created_at?: string | null
          earner_type: string
          id?: string
          last_claimed_at?: string | null
          profile_id?: string | null
          share_bps?: number
          token_id: string
          total_earned_sol?: number | null
          twitter_handle?: string | null
          unclaimed_sol?: number | null
          wallet_address?: string | null
        }
        Update: {
          created_at?: string | null
          earner_type?: string
          id?: string
          last_claimed_at?: string | null
          profile_id?: string | null
          share_bps?: number
          token_id?: string
          total_earned_sol?: number | null
          twitter_handle?: string | null
          unclaimed_sol?: number | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_earners_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_earners_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_pool_claims: {
        Row: {
          claimed_at: string | null
          claimed_sol: number | null
          created_at: string | null
          id: string
          pool_address: string
          processed: boolean | null
          processed_at: string | null
          signature: string
          token_id: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_sol?: number | null
          created_at?: string | null
          id?: string
          pool_address: string
          processed?: boolean | null
          processed_at?: string | null
          signature: string
          token_id: string
        }
        Update: {
          claimed_at?: string | null
          claimed_sol?: number | null
          created_at?: string | null
          id?: string
          pool_address?: string
          processed?: boolean | null
          processed_at?: string | null
          signature?: string
          token_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_pool_claims_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fun_buybacks: {
        Row: {
          amount_sol: number
          created_at: string | null
          fun_token_id: string | null
          id: string
          signature: string | null
          status: string | null
          tokens_bought: number | null
        }
        Insert: {
          amount_sol: number
          created_at?: string | null
          fun_token_id?: string | null
          id?: string
          signature?: string | null
          status?: string | null
          tokens_bought?: number | null
        }
        Update: {
          amount_sol?: number
          created_at?: string | null
          fun_token_id?: string | null
          id?: string
          signature?: string | null
          status?: string | null
          tokens_bought?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fun_buybacks_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      fun_distributions: {
        Row: {
          amount_sol: number
          created_at: string | null
          creator_wallet: string
          distribution_type: string | null
          fun_token_id: string | null
          id: string
          signature: string | null
          status: string | null
          twitter_username: string | null
        }
        Insert: {
          amount_sol: number
          created_at?: string | null
          creator_wallet: string
          distribution_type?: string | null
          fun_token_id?: string | null
          id?: string
          signature?: string | null
          status?: string | null
          twitter_username?: string | null
        }
        Update: {
          amount_sol?: number
          created_at?: string | null
          creator_wallet?: string
          distribution_type?: string | null
          fun_token_id?: string | null
          id?: string
          signature?: string | null
          status?: string | null
          twitter_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fun_distributions_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      fun_fee_claims: {
        Row: {
          claimed_at: string | null
          claimed_sol: number
          created_at: string | null
          creator_distributed: boolean | null
          creator_distribution_id: string | null
          fun_token_id: string | null
          id: string
          pool_address: string
          signature: string | null
        }
        Insert: {
          claimed_at?: string | null
          claimed_sol?: number
          created_at?: string | null
          creator_distributed?: boolean | null
          creator_distribution_id?: string | null
          fun_token_id?: string | null
          id?: string
          pool_address: string
          signature?: string | null
        }
        Update: {
          claimed_at?: string | null
          claimed_sol?: number
          created_at?: string | null
          creator_distributed?: boolean | null
          creator_distribution_id?: string | null
          fun_token_id?: string | null
          id?: string
          pool_address?: string
          signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fun_fee_claims_creator_distribution_id_fkey"
            columns: ["creator_distribution_id"]
            isOneToOne: false
            referencedRelation: "fun_distributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fun_fee_claims_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      fun_token_jobs: {
        Row: {
          client_ip: string | null
          completed_at: string | null
          created_at: string | null
          creator_wallet: string
          dbc_pool_address: string | null
          description: string | null
          error_message: string | null
          fun_token_id: string | null
          id: string
          image_url: string | null
          mint_address: string | null
          name: string
          status: string
          ticker: string
          twitter_url: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          client_ip?: string | null
          completed_at?: string | null
          created_at?: string | null
          creator_wallet: string
          dbc_pool_address?: string | null
          description?: string | null
          error_message?: string | null
          fun_token_id?: string | null
          id?: string
          image_url?: string | null
          mint_address?: string | null
          name: string
          status?: string
          ticker: string
          twitter_url?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          client_ip?: string | null
          completed_at?: string | null
          created_at?: string | null
          creator_wallet?: string
          dbc_pool_address?: string | null
          description?: string | null
          error_message?: string | null
          fun_token_id?: string | null
          id?: string
          image_url?: string | null
          mint_address?: string | null
          name?: string
          status?: string
          ticker?: string
          twitter_url?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      fun_tokens: {
        Row: {
          agent_fee_share_bps: number | null
          agent_id: string | null
          api_account_id: string | null
          bags_creator: string | null
          bags_pool_address: string | null
          bags_signature: string | null
          bonding_curve_type: string | null
          bonding_progress: number | null
          chain: string | null
          chain_id: number | null
          created_at: string | null
          creator_fee_bps: number | null
          creator_wallet: string | null
          dbc_pool_address: string | null
          deployer_wallet: string | null
          description: string | null
          discord_url: string | null
          evm_factory_tx_hash: string | null
          evm_pool_address: string | null
          evm_token_address: string | null
          fair_launch_duration_mins: number | null
          fair_launch_ends_at: string | null
          fee_mode: string | null
          graduation_threshold_bnb: number | null
          holder_count: number | null
          id: string
          image_url: string | null
          is_trading_agent_token: boolean | null
          last_distribution_at: string | null
          launchpad_type: string | null
          market_cap_sol: number | null
          mint_address: string | null
          name: string
          portal_address: string | null
          price_24h_ago: number | null
          price_change_24h: number | null
          price_sol: number | null
          pumpfun_bonding_curve: string | null
          pumpfun_creator: string | null
          pumpfun_signature: string | null
          punch_creator_wallet: string | null
          real_bnb_reserves: number | null
          real_token_reserves: number | null
          starting_mcap_usd: number | null
          status: string | null
          telegram_url: string | null
          ticker: string
          total_fees_claimed: number | null
          total_fees_earned: number | null
          trading_agent_id: string | null
          trading_fee_bps: number | null
          twitter_avatar_url: string | null
          twitter_url: string | null
          twitter_verified: boolean | null
          twitter_verified_type: string | null
          updated_at: string | null
          virtual_bnb_reserves: number | null
          virtual_token_reserves: number | null
          volume_24h_sol: number | null
          website_url: string | null
        }
        Insert: {
          agent_fee_share_bps?: number | null
          agent_id?: string | null
          api_account_id?: string | null
          bags_creator?: string | null
          bags_pool_address?: string | null
          bags_signature?: string | null
          bonding_curve_type?: string | null
          bonding_progress?: number | null
          chain?: string | null
          chain_id?: number | null
          created_at?: string | null
          creator_fee_bps?: number | null
          creator_wallet?: string | null
          dbc_pool_address?: string | null
          deployer_wallet?: string | null
          description?: string | null
          discord_url?: string | null
          evm_factory_tx_hash?: string | null
          evm_pool_address?: string | null
          evm_token_address?: string | null
          fair_launch_duration_mins?: number | null
          fair_launch_ends_at?: string | null
          fee_mode?: string | null
          graduation_threshold_bnb?: number | null
          holder_count?: number | null
          id?: string
          image_url?: string | null
          is_trading_agent_token?: boolean | null
          last_distribution_at?: string | null
          launchpad_type?: string | null
          market_cap_sol?: number | null
          mint_address?: string | null
          name: string
          portal_address?: string | null
          price_24h_ago?: number | null
          price_change_24h?: number | null
          price_sol?: number | null
          pumpfun_bonding_curve?: string | null
          pumpfun_creator?: string | null
          pumpfun_signature?: string | null
          punch_creator_wallet?: string | null
          real_bnb_reserves?: number | null
          real_token_reserves?: number | null
          starting_mcap_usd?: number | null
          status?: string | null
          telegram_url?: string | null
          ticker: string
          total_fees_claimed?: number | null
          total_fees_earned?: number | null
          trading_agent_id?: string | null
          trading_fee_bps?: number | null
          twitter_avatar_url?: string | null
          twitter_url?: string | null
          twitter_verified?: boolean | null
          twitter_verified_type?: string | null
          updated_at?: string | null
          virtual_bnb_reserves?: number | null
          virtual_token_reserves?: number | null
          volume_24h_sol?: number | null
          website_url?: string | null
        }
        Update: {
          agent_fee_share_bps?: number | null
          agent_id?: string | null
          api_account_id?: string | null
          bags_creator?: string | null
          bags_pool_address?: string | null
          bags_signature?: string | null
          bonding_curve_type?: string | null
          bonding_progress?: number | null
          chain?: string | null
          chain_id?: number | null
          created_at?: string | null
          creator_fee_bps?: number | null
          creator_wallet?: string | null
          dbc_pool_address?: string | null
          deployer_wallet?: string | null
          description?: string | null
          discord_url?: string | null
          evm_factory_tx_hash?: string | null
          evm_pool_address?: string | null
          evm_token_address?: string | null
          fair_launch_duration_mins?: number | null
          fair_launch_ends_at?: string | null
          fee_mode?: string | null
          graduation_threshold_bnb?: number | null
          holder_count?: number | null
          id?: string
          image_url?: string | null
          is_trading_agent_token?: boolean | null
          last_distribution_at?: string | null
          launchpad_type?: string | null
          market_cap_sol?: number | null
          mint_address?: string | null
          name?: string
          portal_address?: string | null
          price_24h_ago?: number | null
          price_change_24h?: number | null
          price_sol?: number | null
          pumpfun_bonding_curve?: string | null
          pumpfun_creator?: string | null
          pumpfun_signature?: string | null
          punch_creator_wallet?: string | null
          real_bnb_reserves?: number | null
          real_token_reserves?: number | null
          starting_mcap_usd?: number | null
          status?: string | null
          telegram_url?: string | null
          ticker?: string
          total_fees_claimed?: number | null
          total_fees_earned?: number | null
          trading_agent_id?: string | null
          trading_fee_bps?: number | null
          twitter_avatar_url?: string | null
          twitter_url?: string | null
          twitter_verified?: boolean | null
          twitter_verified_type?: string | null
          updated_at?: string | null
          virtual_bnb_reserves?: number | null
          virtual_token_reserves?: number | null
          volume_24h_sol?: number | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fun_tokens_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fun_tokens_api_account_id_fkey"
            columns: ["api_account_id"]
            isOneToOne: false
            referencedRelation: "api_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fun_tokens_trading_agent_id_fkey"
            columns: ["trading_agent_id"]
            isOneToOne: false
            referencedRelation: "trading_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_conversations: {
        Row: {
          id: string
          is_holder: boolean | null
          last_message_at: string
          message_count: number
          started_at: string
          user_id: string | null
          wallet_address: string | null
        }
        Insert: {
          id?: string
          is_holder?: boolean | null
          last_message_at?: string
          message_count?: number
          started_at?: string
          user_id?: string | null
          wallet_address?: string | null
        }
        Update: {
          id?: string
          is_holder?: boolean | null
          last_message_at?: string
          message_count?: number
          started_at?: string
          user_id?: string | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "governance_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_suggestions: {
        Row: {
          category: string | null
          conversation_id: string | null
          created_at: string
          id: string
          message_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suggestion_text: string
          user_id: string | null
          votes_against: number
          votes_for: number
          wallet_address: string | null
        }
        Insert: {
          category?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggestion_text: string
          user_id?: string | null
          votes_against?: number
          votes_for?: number
          wallet_address?: string | null
        }
        Update: {
          category?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggestion_text?: string
          user_id?: string | null
          votes_against?: number
          votes_for?: number
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_suggestions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "governance_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_suggestions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "governance_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_suggestions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hashtags: {
        Row: {
          created_at: string | null
          id: string
          name: string
          post_count: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          post_count?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          post_count?: number | null
        }
        Relationships: []
      }
      holder_reward_payouts: {
        Row: {
          balance_share: number
          created_at: string | null
          error_message: string | null
          fun_token_id: string
          id: string
          payout_sol: number
          signature: string | null
          snapshot_id: string
          status: string | null
          token_balance: number
          wallet_address: string
        }
        Insert: {
          balance_share: number
          created_at?: string | null
          error_message?: string | null
          fun_token_id: string
          id?: string
          payout_sol: number
          signature?: string | null
          snapshot_id: string
          status?: string | null
          token_balance: number
          wallet_address: string
        }
        Update: {
          balance_share?: number
          created_at?: string | null
          error_message?: string | null
          fun_token_id?: string
          id?: string
          payout_sol?: number
          signature?: string | null
          snapshot_id?: string
          status?: string | null
          token_balance?: number
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "holder_reward_payouts_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holder_reward_payouts_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "holder_reward_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      holder_reward_pool: {
        Row: {
          accumulated_sol: number
          created_at: string | null
          distribution_count: number | null
          fun_token_id: string
          id: string
          last_distribution_at: string | null
          total_distributed_sol: number | null
          updated_at: string | null
        }
        Insert: {
          accumulated_sol?: number
          created_at?: string | null
          distribution_count?: number | null
          fun_token_id: string
          id?: string
          last_distribution_at?: string | null
          total_distributed_sol?: number | null
          updated_at?: string | null
        }
        Update: {
          accumulated_sol?: number
          created_at?: string | null
          distribution_count?: number | null
          fun_token_id?: string
          id?: string
          last_distribution_at?: string | null
          total_distributed_sol?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holder_reward_pool_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: true
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      holder_reward_snapshots: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          fun_token_id: string
          id: string
          min_balance_required: number
          pool_sol: number
          qualified_holders: number
          snapshot_at: string
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          fun_token_id: string
          id?: string
          min_balance_required: number
          pool_sol: number
          qualified_holders?: number
          snapshot_at?: string
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          fun_token_id?: string
          id?: string
          min_balance_required?: number
          pool_sol?: number
          qualified_holders?: number
          snapshot_at?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holder_reward_snapshots_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      hourly_post_log: {
        Row: {
          error_message: string | null
          hourly_fees_sol: number | null
          id: string
          posted_at: string | null
          stats_snapshot: Json | null
          success: boolean | null
          top_agent_id: string | null
          top_agent_ticker: string | null
          tweet_id: string | null
          tweet_text: string | null
        }
        Insert: {
          error_message?: string | null
          hourly_fees_sol?: number | null
          id?: string
          posted_at?: string | null
          stats_snapshot?: Json | null
          success?: boolean | null
          top_agent_id?: string | null
          top_agent_ticker?: string | null
          tweet_id?: string | null
          tweet_text?: string | null
        }
        Update: {
          error_message?: string | null
          hourly_fees_sol?: number | null
          id?: string
          posted_at?: string | null
          stats_snapshot?: Json | null
          success?: boolean | null
          top_agent_id?: string | null
          top_agent_ticker?: string | null
          tweet_id?: string | null
          tweet_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hourly_post_log_top_agent_id_fkey"
            columns: ["top_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_list_config: {
        Row: {
          created_at: string
          id: string
          include_replies: boolean | null
          include_retweets: boolean | null
          is_active: boolean | null
          list_id: string
          list_name: string | null
          max_replies_per_run: number | null
          reply_interval_minutes: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          include_replies?: boolean | null
          include_retweets?: boolean | null
          is_active?: boolean | null
          list_id: string
          list_name?: string | null
          max_replies_per_run?: number | null
          reply_interval_minutes?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          include_replies?: boolean | null
          include_retweets?: boolean | null
          is_active?: boolean | null
          list_id?: string
          list_name?: string | null
          max_replies_per_run?: number | null
          reply_interval_minutes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      influencer_replies: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          influencer_username: string
          list_id: string
          reply_id: string | null
          reply_text: string | null
          status: string | null
          tweet_id: string
          tweet_text: string | null
          tweet_type: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          influencer_username: string
          list_id: string
          reply_id?: string | null
          reply_text?: string | null
          status?: string | null
          tweet_id: string
          tweet_text?: string | null
          tweet_type?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          influencer_username?: string
          list_id?: string
          reply_id?: string | null
          reply_text?: string | null
          status?: string | null
          tweet_id?: string
          tweet_text?: string | null
          tweet_type?: string | null
        }
        Relationships: []
      }
      ip_bans: {
        Row: {
          banned_by: string
          created_at: string
          expires_at: string | null
          id: string
          ip_address: string
          reason: string | null
        }
        Insert: {
          banned_by: string
          created_at?: string
          expires_at?: string | null
          id?: string
          ip_address: string
          reason?: string | null
        }
        Update: {
          banned_by?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          ip_address?: string
          reason?: string | null
        }
        Relationships: []
      }
      kol_accounts: {
        Row: {
          added_at: string | null
          cached_avatar_url: string | null
          created_at: string
          display_name: string | null
          follower_count: number | null
          id: string
          is_active: boolean
          last_scanned_at: string | null
          last_scanned_tweet_id: string | null
          profile_image_url: string | null
          source: string | null
          username: string
        }
        Insert: {
          added_at?: string | null
          cached_avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          follower_count?: number | null
          id?: string
          is_active?: boolean
          last_scanned_at?: string | null
          last_scanned_tweet_id?: string | null
          profile_image_url?: string | null
          source?: string | null
          username: string
        }
        Update: {
          added_at?: string | null
          cached_avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          follower_count?: number | null
          id?: string
          is_active?: boolean
          last_scanned_at?: string | null
          last_scanned_tweet_id?: string | null
          profile_image_url?: string | null
          source?: string | null
          username?: string
        }
        Relationships: []
      }
      kol_contract_tweets: {
        Row: {
          chain: string
          contract_address: string
          created_at: string
          id: string
          kol_account_id: string
          kol_profile_image: string | null
          kol_username: string
          token_image_url: string | null
          token_market_cap: number | null
          token_name: string | null
          token_price_usd: number | null
          token_symbol: string | null
          tweet_id: string
          tweet_text: string | null
          tweet_url: string | null
          tweeted_at: string
        }
        Insert: {
          chain?: string
          contract_address: string
          created_at?: string
          id?: string
          kol_account_id: string
          kol_profile_image?: string | null
          kol_username: string
          token_image_url?: string | null
          token_market_cap?: number | null
          token_name?: string | null
          token_price_usd?: number | null
          token_symbol?: string | null
          tweet_id: string
          tweet_text?: string | null
          tweet_url?: string | null
          tweeted_at: string
        }
        Update: {
          chain?: string
          contract_address?: string
          created_at?: string
          id?: string
          kol_account_id?: string
          kol_profile_image?: string | null
          kol_username?: string
          token_image_url?: string | null
          token_market_cap?: number | null
          token_name?: string | null
          token_price_usd?: number | null
          token_symbol?: string | null
          tweet_id?: string
          tweet_text?: string | null
          tweet_url?: string | null
          tweeted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kol_contract_tweets_kol_account_id_fkey"
            columns: ["kol_account_id"]
            isOneToOne: false
            referencedRelation: "kol_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      kol_scan_errors: {
        Row: {
          created_at: string
          error_message: string
          id: string
          kol_username: string
          raw_response_preview: string | null
          run_id: string | null
        }
        Insert: {
          created_at?: string
          error_message: string
          id?: string
          kol_username: string
          raw_response_preview?: string | null
          run_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string
          id?: string
          kol_username?: string
          raw_response_preview?: string | null
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kol_scan_errors_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "kol_scan_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      kol_scan_runs: {
        Row: {
          accounts_scanned: number
          cas_detected: number
          created_at: string
          duration_ms: number | null
          errors_count: number
          id: string
          raw_response_sample: string | null
          tweets_fetched: number
          tweets_inserted: number
        }
        Insert: {
          accounts_scanned?: number
          cas_detected?: number
          created_at?: string
          duration_ms?: number | null
          errors_count?: number
          id?: string
          raw_response_sample?: string | null
          tweets_fetched?: number
          tweets_inserted?: number
        }
        Update: {
          accounts_scanned?: number
          cas_detected?: number
          created_at?: string
          duration_ms?: number | null
          errors_count?: number
          id?: string
          raw_response_sample?: string | null
          tweets_fetched?: number
          tweets_inserted?: number
        }
        Relationships: []
      }
      launch_idempotency_locks: {
        Row: {
          completed_at: string | null
          created_at: string
          creator_wallet: string
          idempotency_key: string
          result_mint_address: string | null
          result_token_id: string | null
          status: string
          ticker: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          creator_wallet: string
          idempotency_key: string
          result_mint_address?: string | null
          result_token_id?: string | null
          status?: string
          ticker: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          creator_wallet?: string
          idempotency_key?: string
          result_mint_address?: string | null
          result_token_id?: string | null
          status?: string
          ticker?: string
        }
        Relationships: []
      }
      launch_rate_limits: {
        Row: {
          id: string
          ip_address: string
          launched_at: string
          token_id: string | null
        }
        Insert: {
          id?: string
          ip_address: string
          launched_at?: string
          token_id?: string | null
        }
        Update: {
          id?: string
          ip_address?: string
          launched_at?: string
          token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "launch_rate_limits_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      launchpad_transactions: {
        Row: {
          created_at: string | null
          creator_fee_sol: number | null
          id: string
          price_per_token: number
          signature: string
          slot: number | null
          sol_amount: number
          system_fee_sol: number | null
          token_amount: number
          token_id: string
          transaction_type: string
          user_profile_id: string | null
          user_wallet: string
        }
        Insert: {
          created_at?: string | null
          creator_fee_sol?: number | null
          id?: string
          price_per_token: number
          signature: string
          slot?: number | null
          sol_amount: number
          system_fee_sol?: number | null
          token_amount: number
          token_id: string
          transaction_type: string
          user_profile_id?: string | null
          user_wallet: string
        }
        Update: {
          created_at?: string | null
          creator_fee_sol?: number | null
          id?: string
          price_per_token?: number
          signature?: string
          slot?: number | null
          sol_amount?: number
          system_fee_sol?: number | null
          token_amount?: number
          token_id?: string
          transaction_type?: string
          user_profile_id?: string | null
          user_wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "launchpad_transactions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launchpad_transactions_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      limit_orders: {
        Row: {
          amount: number
          amount_type: string
          created_at: string
          executed_at: string | null
          executed_signature: string | null
          expires_at: string | null
          id: string
          order_type: string
          profile_id: string | null
          side: string
          slippage_bps: number | null
          status: string
          token_id: string
          trigger_price: number
          updated_at: string
          user_wallet: string
        }
        Insert: {
          amount: number
          amount_type?: string
          created_at?: string
          executed_at?: string | null
          executed_signature?: string | null
          expires_at?: string | null
          id?: string
          order_type: string
          profile_id?: string | null
          side: string
          slippage_bps?: number | null
          status?: string
          token_id: string
          trigger_price: number
          updated_at?: string
          user_wallet: string
        }
        Update: {
          amount?: number
          amount_type?: string
          created_at?: string
          executed_at?: string | null
          executed_signature?: string | null
          expires_at?: string | null
          id?: string
          order_type?: string
          profile_id?: string | null
          side?: string
          slippage_bps?: number | null
          status?: string
          token_id?: string
          trigger_price?: number
          updated_at?: string
          user_wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "limit_orders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "limit_orders_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      merch_orders: {
        Row: {
          buyer_email: string
          buyer_wallet: string | null
          created_at: string | null
          id: string
          items: Json
          order_number: string
          shipping_address: Json
          shipping_name: string
          status: string | null
          total_sol: number
          tx_signature: string | null
        }
        Insert: {
          buyer_email: string
          buyer_wallet?: string | null
          created_at?: string | null
          id?: string
          items: Json
          order_number: string
          shipping_address: Json
          shipping_name: string
          status?: string | null
          total_sol: number
          tx_signature?: string | null
        }
        Update: {
          buyer_email?: string
          buyer_wallet?: string | null
          created_at?: string | null
          id?: string
          items?: Json
          order_number?: string
          shipping_address?: Json
          shipping_name?: string
          status?: string | null
          total_sol?: number
          tx_signature?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          image_url: string | null
          read: boolean | null
          sender_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          read?: boolean | null
          sender_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          read?: boolean | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_history: {
        Row: {
          created_at: string
          description: string | null
          example_tokens: string[] | null
          id: string
          narrative: string
          popularity_score: number | null
          snapshot_at: string
          token_count: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          example_tokens?: string[] | null
          id?: string
          narrative: string
          popularity_score?: number | null
          snapshot_at?: string
          token_count?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          example_tokens?: string[] | null
          id?: string
          narrative?: string
          popularity_score?: number | null
          snapshot_at?: string
          token_count?: number | null
        }
        Relationships: []
      }
      nfa_batches: {
        Row: {
          batch_number: number
          collection_address: string | null
          created_at: string
          generation_completed_at: string | null
          generation_started_at: string | null
          id: string
          mint_price_sol: number
          minted_count: number
          status: string
          total_slots: number
        }
        Insert: {
          batch_number: number
          collection_address?: string | null
          created_at?: string
          generation_completed_at?: string | null
          generation_started_at?: string | null
          id?: string
          mint_price_sol?: number
          minted_count?: number
          status?: string
          total_slots?: number
        }
        Update: {
          batch_number?: number
          collection_address?: string | null
          created_at?: string
          generation_completed_at?: string | null
          generation_started_at?: string | null
          id?: string
          mint_price_sol?: number
          minted_count?: number
          status?: string
          total_slots?: number
        }
        Relationships: []
      }
      nfa_listings: {
        Row: {
          asking_price_sol: number
          buyer_wallet: string | null
          created_at: string
          id: string
          listed_at: string
          nfa_mint_id: string
          sale_signature: string | null
          seller_wallet: string
          sold_at: string | null
          status: string
        }
        Insert: {
          asking_price_sol: number
          buyer_wallet?: string | null
          created_at?: string
          id?: string
          listed_at?: string
          nfa_mint_id: string
          sale_signature?: string | null
          seller_wallet: string
          sold_at?: string | null
          status?: string
        }
        Update: {
          asking_price_sol?: number
          buyer_wallet?: string | null
          created_at?: string
          id?: string
          listed_at?: string
          nfa_mint_id?: string
          sale_signature?: string | null
          seller_wallet?: string
          sold_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfa_listings_nfa_mint_id_fkey"
            columns: ["nfa_mint_id"]
            isOneToOne: false
            referencedRelation: "nfa_mints"
            referencedColumns: ["id"]
          },
        ]
      }
      nfa_mints: {
        Row: {
          agent_image_url: string | null
          agent_name: string | null
          agent_personality: string | null
          batch_id: string
          created_at: string
          id: string
          listed_for_sale: boolean | null
          listing_price_sol: number | null
          metadata_locked: boolean | null
          minter_wallet: string
          nfa_mint_address: string | null
          owner_wallet: string | null
          payment_signature: string | null
          payment_verified: boolean
          slot_number: number
          status: string
          token_image_url: string | null
          token_name: string | null
          token_ticker: string | null
          trading_agent_id: string | null
        }
        Insert: {
          agent_image_url?: string | null
          agent_name?: string | null
          agent_personality?: string | null
          batch_id: string
          created_at?: string
          id?: string
          listed_for_sale?: boolean | null
          listing_price_sol?: number | null
          metadata_locked?: boolean | null
          minter_wallet: string
          nfa_mint_address?: string | null
          owner_wallet?: string | null
          payment_signature?: string | null
          payment_verified?: boolean
          slot_number: number
          status?: string
          token_image_url?: string | null
          token_name?: string | null
          token_ticker?: string | null
          trading_agent_id?: string | null
        }
        Update: {
          agent_image_url?: string | null
          agent_name?: string | null
          agent_personality?: string | null
          batch_id?: string
          created_at?: string
          id?: string
          listed_for_sale?: boolean | null
          listing_price_sol?: number | null
          metadata_locked?: boolean | null
          minter_wallet?: string
          nfa_mint_address?: string | null
          owner_wallet?: string | null
          payment_signature?: string | null
          payment_verified?: boolean
          slot_number?: number
          status?: string
          token_image_url?: string | null
          token_name?: string | null
          token_ticker?: string | null
          trading_agent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfa_mints_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "nfa_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string
          content: string | null
          created_at: string
          id: string
          post_id: string | null
          read: boolean | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          content?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          read?: boolean | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          content?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          read?: boolean | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opentuna_agent_integrations: {
        Row: {
          agent_id: string
          config: Json | null
          created_at: string | null
          id: string
          integration_id: string
          is_enabled: boolean | null
          last_used_at: string | null
          total_uses: number | null
        }
        Insert: {
          agent_id: string
          config?: Json | null
          created_at?: string | null
          id?: string
          integration_id: string
          is_enabled?: boolean | null
          last_used_at?: string | null
          total_uses?: number | null
        }
        Update: {
          agent_id?: string
          config?: Json | null
          created_at?: string | null
          id?: string
          integration_id?: string
          is_enabled?: boolean | null
          last_used_at?: string | null
          total_uses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opentuna_agent_integrations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "opentuna_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      opentuna_agents: {
        Row: {
          agent_type: string
          allowed_fins: string[] | null
          avatar_url: string | null
          balance_sol: number | null
          blocked_domains: string[] | null
          created_at: string | null
          id: string
          last_active_at: string | null
          name: string
          owner_profile_id: string | null
          owner_wallet: string
          sandbox_type: string | null
          status: string | null
          total_ai_tokens_used: number | null
          total_earned_sol: number | null
          total_fin_calls: number | null
          total_spent_sol: number | null
          updated_at: string | null
          wallet_address: string
          wallet_private_key_encrypted: string
        }
        Insert: {
          agent_type: string
          allowed_fins?: string[] | null
          avatar_url?: string | null
          balance_sol?: number | null
          blocked_domains?: string[] | null
          created_at?: string | null
          id?: string
          last_active_at?: string | null
          name: string
          owner_profile_id?: string | null
          owner_wallet: string
          sandbox_type?: string | null
          status?: string | null
          total_ai_tokens_used?: number | null
          total_earned_sol?: number | null
          total_fin_calls?: number | null
          total_spent_sol?: number | null
          updated_at?: string | null
          wallet_address: string
          wallet_private_key_encrypted: string
        }
        Update: {
          agent_type?: string
          allowed_fins?: string[] | null
          avatar_url?: string | null
          balance_sol?: number | null
          blocked_domains?: string[] | null
          created_at?: string | null
          id?: string
          last_active_at?: string | null
          name?: string
          owner_profile_id?: string | null
          owner_wallet?: string
          sandbox_type?: string | null
          status?: string | null
          total_ai_tokens_used?: number | null
          total_earned_sol?: number | null
          total_fin_calls?: number | null
          total_spent_sol?: number | null
          updated_at?: string | null
          wallet_address?: string
          wallet_private_key_encrypted?: string
        }
        Relationships: [
          {
            foreignKeyName: "opentuna_agents_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opentuna_api_keys: {
        Row: {
          agent_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string | null
          revoked_at: string | null
          total_requests: number | null
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string | null
          revoked_at?: string | null
          total_requests?: number | null
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string | null
          revoked_at?: string | null
          total_requests?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opentuna_api_keys_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "opentuna_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      opentuna_current_flows: {
        Row: {
          amount_sol: number
          completed_at: string | null
          created_at: string | null
          expires_at: string | null
          fin_id: string | null
          id: string
          memo: string
          provider_agent_id: string | null
          request_payload: Json | null
          requester_agent_id: string
          response_payload: Json | null
          service_name: string | null
          signature: string | null
          status: string | null
          tide_receipt_id: string
        }
        Insert: {
          amount_sol: number
          completed_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          fin_id?: string | null
          id?: string
          memo: string
          provider_agent_id?: string | null
          request_payload?: Json | null
          requester_agent_id: string
          response_payload?: Json | null
          service_name?: string | null
          signature?: string | null
          status?: string | null
          tide_receipt_id: string
        }
        Update: {
          amount_sol?: number
          completed_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          fin_id?: string | null
          id?: string
          memo?: string
          provider_agent_id?: string | null
          request_payload?: Json | null
          requester_agent_id?: string
          response_payload?: Json | null
          service_name?: string | null
          signature?: string | null
          status?: string | null
          tide_receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opentuna_current_flows_fin_id_fkey"
            columns: ["fin_id"]
            isOneToOne: false
            referencedRelation: "opentuna_fins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opentuna_current_flows_provider_agent_id_fkey"
            columns: ["provider_agent_id"]
            isOneToOne: false
            referencedRelation: "opentuna_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opentuna_current_flows_requester_agent_id_fkey"
            columns: ["requester_agent_id"]
            isOneToOne: false
            referencedRelation: "opentuna_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      opentuna_deep_memory: {
        Row: {
          agent_id: string
          content: string
          content_tokens: unknown
          created_at: string | null
          embedding: string | null
          expires_at: string | null
          id: string
          importance: number | null
          last_recalled_at: string | null
          memory_type: string
          metadata: Json | null
          recalled_count: number | null
          tags: string[] | null
        }
        Insert: {
          agent_id: string
          content: string
          content_tokens?: unknown
          created_at?: string | null
          embedding?: string | null
          expires_at?: string | null
          id?: string
          importance?: number | null
          last_recalled_at?: string | null
          memory_type: string
          metadata?: Json | null
          recalled_count?: number | null
          tags?: string[] | null
        }
        Update: {
          agent_id?: string
          content?: string
          content_tokens?: unknown
          created_at?: string | null
          embedding?: string | null
          expires_at?: string | null
          id?: string
          importance?: number | null
          last_recalled_at?: string | null
          memory_type?: string
          metadata?: Json | null
          recalled_count?: number | null
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "opentuna_deep_memory_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "opentuna_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      opentuna_dna: {
        Row: {
          agent_id: string
          echo_pattern: Json | null
          fallback_model: string | null
          id: string
          migration_goals: Json | null
          origin_story: string | null
          personality: string
          preferred_model: string | null
          reef_limits: string[] | null
          species_traits: string[] | null
          updated_at: string | null
          version: number | null
          voice_sample: string | null
        }
        Insert: {
          agent_id: string
          echo_pattern?: Json | null
          fallback_model?: string | null
          id?: string
          migration_goals?: Json | null
          origin_story?: string | null
          personality: string
          preferred_model?: string | null
          reef_limits?: string[] | null
          species_traits?: string[] | null
          updated_at?: string | null
          version?: number | null
          voice_sample?: string | null
        }
        Update: {
          agent_id?: string
          echo_pattern?: Json | null
          fallback_model?: string | null
          id?: string
          migration_goals?: Json | null
          origin_story?: string | null
          personality?: string
          preferred_model?: string | null
          reef_limits?: string[] | null
          species_traits?: string[] | null
          updated_at?: string | null
          version?: number | null
          voice_sample?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opentuna_dna_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "opentuna_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      opentuna_fin_executions: {
        Row: {
          agent_id: string
          created_at: string | null
          error_message: string | null
          execution_time_ms: number | null
          fin_name: string
          id: string
          params: Json | null
          params_hash: string
          result_summary: string | null
          success: boolean
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          fin_name: string
          id?: string
          params?: Json | null
          params_hash: string
          result_summary?: string | null
          success: boolean
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          fin_name?: string
          id?: string
          params?: Json | null
          params_hash?: string
          result_summary?: string | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "opentuna_fin_executions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "opentuna_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      opentuna_fin_rack: {
        Row: {
          agent_id: string
          custom_config: Json | null
          enabled: boolean | null
          fin_id: string
          id: string
          installed_at: string | null
          last_used_at: string | null
          proficiency: number | null
          times_used: number | null
        }
        Insert: {
          agent_id: string
          custom_config?: Json | null
          enabled?: boolean | null
          fin_id: string
          id?: string
          installed_at?: string | null
          last_used_at?: string | null
          proficiency?: number | null
          times_used?: number | null
        }
        Update: {
          agent_id?: string
          custom_config?: Json | null
          enabled?: boolean | null
          fin_id?: string
          id?: string
          installed_at?: string | null
          last_used_at?: string | null
          proficiency?: number | null
          times_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opentuna_fin_rack_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "opentuna_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opentuna_fin_rack_fin_id_fkey"
            columns: ["fin_id"]
            isOneToOne: false
            referencedRelation: "opentuna_fins"
            referencedColumns: ["id"]
          },
        ]
      }
      opentuna_fins: {
        Row: {
          avg_execution_ms: number | null
          category: string
          cost_sol: number | null
          created_at: string | null
          description: string
          display_name: string
          endpoint: string | null
          handler_code: string | null
          id: string
          is_native: boolean | null
          is_verified: boolean | null
          name: string
          permission_scope: string[] | null
          provider_agent_id: string | null
          provider_wallet: string | null
          security_scan_passed: boolean | null
          success_rate: number | null
          total_uses: number | null
          verified_at: string | null
        }
        Insert: {
          avg_execution_ms?: number | null
          category: string
          cost_sol?: number | null
          created_at?: string | null
          description: string
          display_name: string
          endpoint?: string | null
          handler_code?: string | null
          id?: string
          is_native?: boolean | null
          is_verified?: boolean | null
          name: string
          permission_scope?: string[] | null
          provider_agent_id?: string | null
          provider_wallet?: string | null
          security_scan_passed?: boolean | null
          success_rate?: number | null
          total_uses?: number | null
          verified_at?: string | null
        }
        Update: {
          avg_execution_ms?: number | null
          category?: string
          cost_sol?: number | null
          created_at?: string | null
          description?: string
          display_name?: string
          endpoint?: string | null
          handler_code?: string | null
          id?: string
          is_native?: boolean | null
          is_verified?: boolean | null
          name?: string
          permission_scope?: string[] | null
          provider_agent_id?: string | null
          provider_wallet?: string | null
          security_scan_passed?: boolean | null
          success_rate?: number | null
          total_uses?: number | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opentuna_fins_provider_agent_id_fkey"
            columns: ["provider_agent_id"]
            isOneToOne: false
            referencedRelation: "opentuna_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      opentuna_school_members: {
        Row: {
          agent_id: string
          id: string
          joined_at: string | null
          role: string
          school_id: string
          specialization: string[] | null
        }
        Insert: {
          agent_id: string
          id?: string
          joined_at?: string | null
          role: string
          school_id: string
          specialization?: string[] | null
        }
        Update: {
          agent_id?: string
          id?: string
          joined_at?: string | null
          role?: string
          school_id?: string
          specialization?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "opentuna_school_members_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "opentuna_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opentuna_school_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "opentuna_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      opentuna_school_tasks: {
        Row: {
          assigned_by: string
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          deadline: string | null
          error_message: string | null
          id: string
          priority: number | null
          result: Json | null
          school_id: string
          started_at: string | null
          status: string | null
          task_payload: Json
          task_type: string
        }
        Insert: {
          assigned_by: string
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          deadline?: string | null
          error_message?: string | null
          id?: string
          priority?: number | null
          result?: Json | null
          school_id: string
          started_at?: string | null
          status?: string | null
          task_payload: Json
          task_type: string
        }
        Update: {
          assigned_by?: string
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          deadline?: string | null
          error_message?: string | null
          id?: string
          priority?: number | null
          result?: Json | null
          school_id?: string
          started_at?: string | null
          status?: string | null
          task_payload?: Json
          task_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "opentuna_school_tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "opentuna_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opentuna_school_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "opentuna_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opentuna_school_tasks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "opentuna_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      opentuna_schools: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          lead_agent_id: string
          name: string
          total_tasks_completed: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          lead_agent_id: string
          name: string
          total_tasks_completed?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          lead_agent_id?: string
          name?: string
          total_tasks_completed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opentuna_schools_lead_agent_id_fkey"
            columns: ["lead_agent_id"]
            isOneToOne: false
            referencedRelation: "opentuna_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      opentuna_sonar_config: {
        Row: {
          agent_id: string
          cost_reset_at: string | null
          current_daily_cost_sol: number | null
          id: string
          interval_minutes: number | null
          is_paused: boolean | null
          last_ping_at: string | null
          max_daily_cost_sol: number | null
          mode: string | null
          next_ping_at: string | null
          paused_reason: string | null
          total_pings: number | null
        }
        Insert: {
          agent_id: string
          cost_reset_at?: string | null
          current_daily_cost_sol?: number | null
          id?: string
          interval_minutes?: number | null
          is_paused?: boolean | null
          last_ping_at?: string | null
          max_daily_cost_sol?: number | null
          mode?: string | null
          next_ping_at?: string | null
          paused_reason?: string | null
          total_pings?: number | null
        }
        Update: {
          agent_id?: string
          cost_reset_at?: string | null
          current_daily_cost_sol?: number | null
          id?: string
          interval_minutes?: number | null
          is_paused?: boolean | null
          last_ping_at?: string | null
          max_daily_cost_sol?: number | null
          mode?: string | null
          next_ping_at?: string | null
          paused_reason?: string | null
          total_pings?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opentuna_sonar_config_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "opentuna_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      opentuna_sonar_pings: {
        Row: {
          action: string
          agent_id: string
          context_snapshot: Json | null
          cost_sol: number | null
          error_message: string | null
          executed_at: string | null
          execution_result: Json | null
          id: string
          priority: number | null
          reasoning: string | null
          success: boolean | null
          tokens_used: number | null
        }
        Insert: {
          action: string
          agent_id: string
          context_snapshot?: Json | null
          cost_sol?: number | null
          error_message?: string | null
          executed_at?: string | null
          execution_result?: Json | null
          id?: string
          priority?: number | null
          reasoning?: string | null
          success?: boolean | null
          tokens_used?: number | null
        }
        Update: {
          action?: string
          agent_id?: string
          context_snapshot?: Json | null
          cost_sol?: number | null
          error_message?: string | null
          executed_at?: string | null
          execution_result?: Json | null
          id?: string
          priority?: number | null
          reasoning?: string | null
          success?: boolean | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opentuna_sonar_pings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "opentuna_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      opentuna_tunanet_messages: {
        Row: {
          agent_id: string
          channel: string
          content: string
          created_at: string | null
          direction: string
          external_id: string | null
          id: string
          metadata: Json | null
          parent_message_id: string | null
          processed_at: string | null
          response_message_id: string | null
          stream_id: string | null
        }
        Insert: {
          agent_id: string
          channel: string
          content: string
          created_at?: string | null
          direction: string
          external_id?: string | null
          id?: string
          metadata?: Json | null
          parent_message_id?: string | null
          processed_at?: string | null
          response_message_id?: string | null
          stream_id?: string | null
        }
        Update: {
          agent_id?: string
          channel?: string
          content?: string
          created_at?: string | null
          direction?: string
          external_id?: string | null
          id?: string
          metadata?: Json | null
          parent_message_id?: string | null
          processed_at?: string | null
          response_message_id?: string | null
          stream_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opentuna_tunanet_messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "opentuna_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opentuna_tunanet_messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "opentuna_tunanet_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opentuna_tunanet_messages_response_message_id_fkey"
            columns: ["response_message_id"]
            isOneToOne: false
            referencedRelation: "opentuna_tunanet_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_fee_distributions: {
        Row: {
          amount_sol: number
          created_at: string | null
          fee_mode: string | null
          fun_token_id: string | null
          id: string
          launchpad_type: string | null
          signature: string | null
          status: string | null
          token_name: string | null
          token_ticker: string | null
        }
        Insert: {
          amount_sol?: number
          created_at?: string | null
          fee_mode?: string | null
          fun_token_id?: string | null
          id?: string
          launchpad_type?: string | null
          signature?: string | null
          status?: string | null
          token_name?: string | null
          token_ticker?: string | null
        }
        Update: {
          amount_sol?: number
          created_at?: string | null
          fee_mode?: string | null
          fun_token_id?: string | null
          id?: string
          launchpad_type?: string | null
          signature?: string | null
          status?: string | null
          token_name?: string | null
          token_ticker?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_fee_distributions_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_token_metadata: {
        Row: {
          created_at: string
          creator_wallet: string | null
          description: string | null
          discord_url: string | null
          expires_at: string | null
          image_url: string | null
          mint_address: string
          name: string
          telegram_url: string | null
          ticker: string
          twitter_url: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          creator_wallet?: string | null
          description?: string | null
          discord_url?: string | null
          expires_at?: string | null
          image_url?: string | null
          mint_address: string
          name: string
          telegram_url?: string | null
          ticker: string
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          creator_wallet?: string | null
          description?: string | null
          discord_url?: string | null
          expires_at?: string | null
          image_url?: string | null
          mint_address?: string
          name?: string
          telegram_url?: string | null
          ticker?: string
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      pool_state_cache: {
        Row: {
          bonding_progress: number | null
          holder_count: number | null
          is_graduated: boolean | null
          market_cap_sol: number | null
          mint_address: string | null
          pool_address: string
          price_sol: number | null
          real_sol_reserves: number | null
          updated_at: string | null
          virtual_sol_reserves: number | null
          virtual_token_reserves: number | null
        }
        Insert: {
          bonding_progress?: number | null
          holder_count?: number | null
          is_graduated?: boolean | null
          market_cap_sol?: number | null
          mint_address?: string | null
          pool_address: string
          price_sol?: number | null
          real_sol_reserves?: number | null
          updated_at?: string | null
          virtual_sol_reserves?: number | null
          virtual_token_reserves?: number | null
        }
        Update: {
          bonding_progress?: number | null
          holder_count?: number | null
          is_graduated?: boolean | null
          market_cap_sol?: number | null
          mint_address?: string | null
          pool_address?: string
          price_sol?: number | null
          real_sol_reserves?: number | null
          updated_at?: string | null
          virtual_sol_reserves?: number | null
          virtual_token_reserves?: number | null
        }
        Relationships: []
      }
      post_hashtags: {
        Row: {
          created_at: string | null
          hashtag_id: string
          id: string
          post_id: string
        }
        Insert: {
          created_at?: string | null
          hashtag_id: string
          id?: string
          post_id: string
        }
        Update: {
          created_at?: string | null
          hashtag_id?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_hashtags_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_hashtags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_repost: boolean | null
          likes_count: number | null
          original_post_id: string | null
          parent_id: string | null
          pinned: boolean | null
          pinned_at: string | null
          pinned_by: string | null
          replies_count: number | null
          reposts_count: number | null
          short_id: string | null
          updated_at: string
          user_id: string
          views_count: number | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_repost?: boolean | null
          likes_count?: number | null
          original_post_id?: string | null
          parent_id?: string | null
          pinned?: boolean | null
          pinned_at?: string | null
          pinned_by?: string | null
          replies_count?: number | null
          reposts_count?: number | null
          short_id?: string | null
          updated_at?: string
          user_id: string
          views_count?: number | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_repost?: boolean | null
          likes_count?: number | null
          original_post_id?: string | null
          parent_id?: string | null
          pinned?: boolean | null
          pinned_at?: string | null
          pinned_by?: string | null
          replies_count?: number | null
          reposts_count?: number | null
          short_id?: string | null
          updated_at?: string
          user_id?: string
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_original_post_id_fkey"
            columns: ["original_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          display_name: string
          evm_wallet_address: string | null
          followers_count: number | null
          following_count: number | null
          id: string
          location: string | null
          posts_count: number | null
          privy_did: string | null
          privy_evm_wallet_id: string | null
          privy_wallet_id: string | null
          solana_wallet_address: string | null
          updated_at: string
          username: string
          username_changed_at: string | null
          verified_type: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name: string
          evm_wallet_address?: string | null
          followers_count?: number | null
          following_count?: number | null
          id: string
          location?: string | null
          posts_count?: number | null
          privy_did?: string | null
          privy_evm_wallet_id?: string | null
          privy_wallet_id?: string | null
          solana_wallet_address?: string | null
          updated_at?: string
          username: string
          username_changed_at?: string | null
          verified_type?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string
          evm_wallet_address?: string | null
          followers_count?: number | null
          following_count?: number | null
          id?: string
          location?: string | null
          posts_count?: number | null
          privy_did?: string | null
          privy_evm_wallet_id?: string | null
          privy_wallet_id?: string | null
          solana_wallet_address?: string | null
          updated_at?: string
          username?: string
          username_changed_at?: string | null
          verified_type?: string | null
          website?: string | null
        }
        Relationships: []
      }
      promo_mention_queue: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          follower_count: number | null
          id: string
          is_verified: boolean | null
          mention_type: string | null
          processed_at: string | null
          status: string | null
          tweet_author: string | null
          tweet_author_id: string | null
          tweet_created_at: string | null
          tweet_id: string
          tweet_text: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          follower_count?: number | null
          id?: string
          is_verified?: boolean | null
          mention_type?: string | null
          processed_at?: string | null
          status?: string | null
          tweet_author?: string | null
          tweet_author_id?: string | null
          tweet_created_at?: string | null
          tweet_id: string
          tweet_text?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          follower_count?: number | null
          id?: string
          is_verified?: boolean | null
          mention_type?: string | null
          processed_at?: string | null
          status?: string | null
          tweet_author?: string | null
          tweet_author_id?: string | null
          tweet_created_at?: string | null
          tweet_id?: string
          tweet_text?: string | null
        }
        Relationships: []
      }
      promo_mention_replies: {
        Row: {
          conversation_id: string | null
          created_at: string
          error_message: string | null
          id: string
          mention_type: string | null
          reply_id: string | null
          reply_text: string | null
          reply_type: string
          status: string
          tweet_author: string
          tweet_author_id: string | null
          tweet_id: string
          tweet_text: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          mention_type?: string | null
          reply_id?: string | null
          reply_text?: string | null
          reply_type?: string
          status?: string
          tweet_author: string
          tweet_author_id?: string | null
          tweet_id: string
          tweet_text?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          mention_type?: string | null
          reply_id?: string | null
          reply_text?: string | null
          reply_type?: string
          status?: string
          tweet_author?: string
          tweet_author_id?: string | null
          tweet_id?: string
          tweet_text?: string | null
        }
        Relationships: []
      }
      pumpfun_fee_claims: {
        Row: {
          claimed_at: string | null
          claimed_sol: number | null
          created_at: string | null
          creator_amount_sol: number | null
          distributed: boolean | null
          distributed_at: string | null
          distribution_signature: string | null
          fun_token_id: string | null
          id: string
          mint_address: string
          platform_amount_sol: number | null
          signature: string | null
        }
        Insert: {
          claimed_at?: string | null
          claimed_sol?: number | null
          created_at?: string | null
          creator_amount_sol?: number | null
          distributed?: boolean | null
          distributed_at?: string | null
          distribution_signature?: string | null
          fun_token_id?: string | null
          id?: string
          mint_address: string
          platform_amount_sol?: number | null
          signature?: string | null
        }
        Update: {
          claimed_at?: string | null
          claimed_sol?: number | null
          created_at?: string | null
          creator_amount_sol?: number | null
          distributed?: boolean | null
          distributed_at?: string | null
          distribution_signature?: string | null
          fun_token_id?: string | null
          id?: string
          mint_address?: string
          platform_amount_sol?: number | null
          signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pumpfun_fee_claims_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      pumpfun_trending_tokens: {
        Row: {
          age_hours: number | null
          created_timestamp: number | null
          description: string | null
          holder_count: number | null
          id: string
          image_url: string | null
          is_king_of_hill: boolean | null
          last_synced_at: string | null
          liquidity_sol: number | null
          market_cap_sol: number | null
          mint_address: string
          name: string | null
          narrative_category: string | null
          narrative_match: string | null
          price_sol: number | null
          reply_count: number | null
          symbol: string | null
          token_score: number | null
          virtual_sol_reserves: number | null
          volume_trend: string | null
        }
        Insert: {
          age_hours?: number | null
          created_timestamp?: number | null
          description?: string | null
          holder_count?: number | null
          id?: string
          image_url?: string | null
          is_king_of_hill?: boolean | null
          last_synced_at?: string | null
          liquidity_sol?: number | null
          market_cap_sol?: number | null
          mint_address: string
          name?: string | null
          narrative_category?: string | null
          narrative_match?: string | null
          price_sol?: number | null
          reply_count?: number | null
          symbol?: string | null
          token_score?: number | null
          virtual_sol_reserves?: number | null
          volume_trend?: string | null
        }
        Update: {
          age_hours?: number | null
          created_timestamp?: number | null
          description?: string | null
          holder_count?: number | null
          id?: string
          image_url?: string | null
          is_king_of_hill?: boolean | null
          last_synced_at?: string | null
          liquidity_sol?: number | null
          market_cap_sol?: number | null
          mint_address?: string
          name?: string | null
          narrative_category?: string | null
          narrative_match?: string | null
          price_sol?: number | null
          reply_count?: number | null
          symbol?: string | null
          token_score?: number | null
          virtual_sol_reserves?: number | null
          volume_trend?: string | null
        }
        Relationships: []
      }
      punch_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          username: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          username?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          username?: string | null
        }
        Relationships: []
      }
      punch_counters: {
        Row: {
          id: string
          total_punches: number
          updated_at: string | null
        }
        Insert: {
          id?: string
          total_punches?: number
          updated_at?: string | null
        }
        Update: {
          id?: string
          total_punches?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      punch_users: {
        Row: {
          created_at: string
          fingerprint: string | null
          id: string
          ip_address: string | null
          total_fees_earned_sol: number
          total_launches: number
          total_punches: number
          updated_at: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          fingerprint?: string | null
          id?: string
          ip_address?: string | null
          total_fees_earned_sol?: number
          total_launches?: number
          total_punches?: number
          updated_at?: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          fingerprint?: string | null
          id?: string
          ip_address?: string | null
          total_fees_earned_sol?: number
          total_launches?: number
          total_punches?: number
          updated_at?: string
          wallet_address?: string
        }
        Relationships: []
      }
      punch_visitors: {
        Row: {
          created_at: string | null
          fingerprint: string
          id: string
        }
        Insert: {
          created_at?: string | null
          fingerprint: string
          id?: string
        }
        Update: {
          created_at?: string | null
          fingerprint?: string
          id?: string
        }
        Relationships: []
      }
      punch_votes: {
        Row: {
          created_at: string | null
          fun_token_id: string
          id: string
          vote_type: number
          voter_fingerprint: string
        }
        Insert: {
          created_at?: string | null
          fun_token_id: string
          id?: string
          vote_type: number
          voter_fingerprint: string
        }
        Update: {
          created_at?: string | null
          fun_token_id?: string
          id?: string
          vote_type?: number
          voter_fingerprint?: string
        }
        Relationships: [
          {
            foreignKeyName: "punch_votes_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string | null
          id: string
          profile_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          profile_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_rewards: {
        Row: {
          created_at: string | null
          id: string
          paid: boolean
          payout_signature: string | null
          referred_id: string
          referrer_id: string
          reward_pct: number
          reward_sol: number
          trade_signature: string | null
          trade_sol_amount: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          paid?: boolean
          payout_signature?: string | null
          referred_id: string
          referrer_id: string
          reward_pct?: number
          reward_sol?: number
          trade_signature?: string | null
          trade_sol_amount?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          paid?: boolean
          payout_signature?: string | null
          referred_id?: string
          referrer_id?: string
          reward_pct?: number
          reward_sol?: number
          trade_signature?: string | null
          trade_sol_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string | null
          id: string
          referred_id: string
          referred_wallet: string | null
          referrer_id: string
          total_rewards_sol: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          referred_id: string
          referred_wallet?: string | null
          referrer_id: string
          total_rewards_sol?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          referred_id?: string
          referred_wallet?: string | null
          referrer_id?: string
          total_rewards_sol?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reason: string
          reported_post_id: string | null
          reported_user_id: string | null
          reporter_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          reported_post_id?: string | null
          reported_user_id?: string | null
          reporter_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          reported_post_id?: string | null
          reported_user_id?: string | null
          reporter_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sniper_trades: {
        Row: {
          bought_at: string | null
          buy_amount_sol: number
          buy_signature: string | null
          buy_slot: number | null
          created_at: string
          error_message: string | null
          fun_token_id: string | null
          id: string
          mint_address: string
          pool_address: string
          scheduled_sell_at: string | null
          sell_signature: string | null
          sell_slot: number | null
          sol_received: number | null
          sold_at: string | null
          status: string
          token_id: string | null
          tokens_received: number | null
        }
        Insert: {
          bought_at?: string | null
          buy_amount_sol?: number
          buy_signature?: string | null
          buy_slot?: number | null
          created_at?: string
          error_message?: string | null
          fun_token_id?: string | null
          id?: string
          mint_address: string
          pool_address: string
          scheduled_sell_at?: string | null
          sell_signature?: string | null
          sell_slot?: number | null
          sol_received?: number | null
          sold_at?: string | null
          status?: string
          token_id?: string | null
          tokens_received?: number | null
        }
        Update: {
          bought_at?: string | null
          buy_amount_sol?: number
          buy_signature?: string | null
          buy_slot?: number | null
          created_at?: string
          error_message?: string | null
          fun_token_id?: string | null
          id?: string
          mint_address?: string
          pool_address?: string
          scheduled_sell_at?: string | null
          sell_signature?: string | null
          sell_slot?: number | null
          sol_received?: number | null
          sold_at?: string | null
          status?: string
          token_id?: string | null
          tokens_received?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sniper_trades_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sniper_trades_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      social_reward_events: {
        Row: {
          created_at: string | null
          id: string
          points: number
          post_id: string
          post_url: string | null
          reward_type: string
          social_reward_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          points?: number
          post_id: string
          post_url?: string | null
          reward_type: string
          social_reward_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          points?: number
          post_id?: string
          post_url?: string | null
          reward_type?: string
          social_reward_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_reward_events_social_reward_id_fkey"
            columns: ["social_reward_id"]
            isOneToOne: false
            referencedRelation: "social_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      social_rewards: {
        Row: {
          created_at: string | null
          id: string
          joined_at: string
          last_checked_at: string | null
          last_checked_post_id: string | null
          points: number | null
          privy_did: string
          profile_id: string
          twitter_avatar_url: string | null
          twitter_followers: number | null
          twitter_name: string | null
          twitter_username: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          joined_at?: string
          last_checked_at?: string | null
          last_checked_post_id?: string | null
          points?: number | null
          privy_did: string
          profile_id: string
          twitter_avatar_url?: string | null
          twitter_followers?: number | null
          twitter_name?: string | null
          twitter_username: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          joined_at?: string
          last_checked_at?: string | null
          last_checked_post_id?: string | null
          points?: number | null
          privy_did?: string
          profile_id?: string
          twitter_avatar_url?: string | null
          twitter_followers?: number | null
          twitter_name?: string | null
          twitter_username?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      subtuna: {
        Row: {
          agent_id: string | null
          banner_url: string | null
          created_at: string | null
          description: string | null
          fun_token_id: string | null
          icon_url: string | null
          id: string
          member_count: number | null
          name: string
          post_count: number | null
          rules: Json | null
          settings: Json | null
          style_source_username: string | null
          ticker: string | null
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          banner_url?: string | null
          created_at?: string | null
          description?: string | null
          fun_token_id?: string | null
          icon_url?: string | null
          id?: string
          member_count?: number | null
          name: string
          post_count?: number | null
          rules?: Json | null
          settings?: Json | null
          style_source_username?: string | null
          ticker?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          banner_url?: string | null
          created_at?: string | null
          description?: string | null
          fun_token_id?: string | null
          icon_url?: string | null
          id?: string
          member_count?: number | null
          name?: string
          post_count?: number | null
          rules?: Json | null
          settings?: Json | null
          style_source_username?: string | null
          ticker?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subtuna_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtuna_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: true
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      subtuna_comment_votes: {
        Row: {
          comment_id: string
          created_at: string | null
          id: string
          user_id: string
          vote_type: number
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          id?: string
          user_id: string
          vote_type: number
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
          vote_type?: number
        }
        Relationships: [
          {
            foreignKeyName: "subtuna_comment_votes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "subtuna_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtuna_comment_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subtuna_comments: {
        Row: {
          author_agent_id: string | null
          author_id: string | null
          content: string
          created_at: string | null
          downvotes: number | null
          id: string
          is_agent_comment: boolean | null
          parent_comment_id: string | null
          post_id: string
          score: number | null
          updated_at: string | null
          upvotes: number | null
        }
        Insert: {
          author_agent_id?: string | null
          author_id?: string | null
          content: string
          created_at?: string | null
          downvotes?: number | null
          id?: string
          is_agent_comment?: boolean | null
          parent_comment_id?: string | null
          post_id: string
          score?: number | null
          updated_at?: string | null
          upvotes?: number | null
        }
        Update: {
          author_agent_id?: string | null
          author_id?: string | null
          content?: string
          created_at?: string | null
          downvotes?: number | null
          id?: string
          is_agent_comment?: boolean | null
          parent_comment_id?: string | null
          post_id?: string
          score?: number | null
          updated_at?: string | null
          upvotes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subtuna_comments_author_agent_id_fkey"
            columns: ["author_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtuna_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtuna_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "subtuna_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtuna_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "subtuna_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      subtuna_guest_votes: {
        Row: {
          created_at: string | null
          id: string
          ip_hash: string
          post_id: string
          vote_type: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_hash: string
          post_id: string
          vote_type: number
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_hash?: string
          post_id?: string
          vote_type?: number
        }
        Relationships: [
          {
            foreignKeyName: "subtuna_guest_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "subtuna_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      subtuna_members: {
        Row: {
          id: string
          is_moderator: boolean | null
          joined_at: string | null
          karma_in_subtuna: number | null
          role: string | null
          subtuna_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_moderator?: boolean | null
          joined_at?: string | null
          karma_in_subtuna?: number | null
          role?: string | null
          subtuna_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_moderator?: boolean | null
          joined_at?: string | null
          karma_in_subtuna?: number | null
          role?: string | null
          subtuna_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtuna_members_subtuna_id_fkey"
            columns: ["subtuna_id"]
            isOneToOne: false
            referencedRelation: "subtuna"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtuna_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subtuna_posts: {
        Row: {
          author_agent_id: string | null
          author_id: string | null
          comment_count: number | null
          content: string | null
          created_at: string | null
          downvotes: number | null
          guest_downvotes: number | null
          guest_upvotes: number | null
          id: string
          image_url: string | null
          is_agent_post: boolean | null
          is_locked: boolean | null
          is_pinned: boolean | null
          link_url: string | null
          post_type: string | null
          score: number | null
          slug: string | null
          subtuna_id: string
          title: string
          updated_at: string | null
          upvotes: number | null
          x_post_id: string | null
        }
        Insert: {
          author_agent_id?: string | null
          author_id?: string | null
          comment_count?: number | null
          content?: string | null
          created_at?: string | null
          downvotes?: number | null
          guest_downvotes?: number | null
          guest_upvotes?: number | null
          id?: string
          image_url?: string | null
          is_agent_post?: boolean | null
          is_locked?: boolean | null
          is_pinned?: boolean | null
          link_url?: string | null
          post_type?: string | null
          score?: number | null
          slug?: string | null
          subtuna_id: string
          title: string
          updated_at?: string | null
          upvotes?: number | null
          x_post_id?: string | null
        }
        Update: {
          author_agent_id?: string | null
          author_id?: string | null
          comment_count?: number | null
          content?: string | null
          created_at?: string | null
          downvotes?: number | null
          guest_downvotes?: number | null
          guest_upvotes?: number | null
          id?: string
          image_url?: string | null
          is_agent_post?: boolean | null
          is_locked?: boolean | null
          is_pinned?: boolean | null
          link_url?: string | null
          post_type?: string | null
          score?: number | null
          slug?: string | null
          subtuna_id?: string
          title?: string
          updated_at?: string | null
          upvotes?: number | null
          x_post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subtuna_posts_author_agent_id_fkey"
            columns: ["author_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtuna_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtuna_posts_subtuna_id_fkey"
            columns: ["subtuna_id"]
            isOneToOne: false
            referencedRelation: "subtuna"
            referencedColumns: ["id"]
          },
        ]
      }
      subtuna_reports: {
        Row: {
          content_id: string
          content_type: string
          created_at: string | null
          id: string
          moderator_notes: string | null
          reason: string
          reporter_id: string | null
          resolved_at: string | null
          reviewed_by: string | null
          status: string | null
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string | null
          id?: string
          moderator_notes?: string | null
          reason: string
          reporter_id?: string | null
          resolved_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string | null
          id?: string
          moderator_notes?: string | null
          reason?: string
          reporter_id?: string | null
          resolved_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subtuna_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtuna_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subtuna_votes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
          vote_type: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
          vote_type: number
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
          vote_type?: number
        }
        Relationships: [
          {
            foreignKeyName: "subtuna_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "subtuna_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtuna_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      token_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          likes_count: number | null
          parent_id: string | null
          token_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          likes_count?: number | null
          parent_id?: string | null
          token_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          likes_count?: number | null
          parent_id?: string | null
          token_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "token_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_comments_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      token_holdings: {
        Row: {
          balance: number | null
          created_at: string | null
          id: string
          profile_id: string | null
          token_id: string
          updated_at: string | null
          wallet_address: string
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          id?: string
          profile_id?: string | null
          token_id: string
          updated_at?: string | null
          wallet_address: string
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          id?: string
          profile_id?: string | null
          token_id?: string
          updated_at?: string | null
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_holdings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_holdings_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      token_price_history: {
        Row: {
          created_at: string
          id: string
          interval_type: string
          market_cap_sol: number
          price_sol: number
          timestamp: string
          token_id: string
          volume_sol: number
        }
        Insert: {
          created_at?: string
          id?: string
          interval_type?: string
          market_cap_sol?: number
          price_sol: number
          timestamp?: string
          token_id: string
          volume_sol?: number
        }
        Update: {
          created_at?: string
          id?: string
          interval_type?: string
          market_cap_sol?: number
          price_sol?: number
          timestamp?: string
          token_id?: string
          volume_sol?: number
        }
        Relationships: [
          {
            foreignKeyName: "token_price_history_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      token_promotions: {
        Row: {
          amount_sol: number
          created_at: string
          expires_at: string | null
          fun_token_id: string
          id: string
          paid_at: string | null
          payment_address: string
          payment_private_key: string
          posted_at: string | null
          promoter_wallet: string
          signature: string | null
          status: string
          twitter_post_id: string | null
        }
        Insert: {
          amount_sol?: number
          created_at?: string
          expires_at?: string | null
          fun_token_id: string
          id?: string
          paid_at?: string | null
          payment_address: string
          payment_private_key: string
          posted_at?: string | null
          promoter_wallet: string
          signature?: string | null
          status?: string
          twitter_post_id?: string | null
        }
        Update: {
          amount_sol?: number
          created_at?: string
          expires_at?: string | null
          fun_token_id?: string
          id?: string
          paid_at?: string | null
          payment_address?: string
          payment_private_key?: string
          posted_at?: string | null
          promoter_wallet?: string
          signature?: string | null
          status?: string
          twitter_post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "token_promotions_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      tokens: {
        Row: {
          api_account_id: string | null
          bonding_curve_progress: number | null
          claim_locked_at: string | null
          created_at: string | null
          creator_fee_bps: number | null
          creator_id: string | null
          creator_wallet: string
          damm_pool_address: string | null
          dbc_pool_address: string | null
          description: string | null
          discord_url: string | null
          graduated_at: string | null
          graduation_threshold_sol: number | null
          holder_count: number | null
          id: string
          image_url: string | null
          last_claim_at: string | null
          market_cap_sol: number | null
          migration_status: string | null
          mint_address: string
          name: string
          price_24h_ago: number | null
          price_change_24h: number | null
          price_sol: number | null
          quote_decimals: number | null
          quote_token: string | null
          real_sol_reserves: number | null
          real_token_reserves: number | null
          status: string | null
          system_fee_bps: number | null
          system_unclaimed_sol: number | null
          telegram_url: string | null
          ticker: string
          total_supply: number | null
          twitter_url: string | null
          updated_at: string | null
          virtual_sol_reserves: number | null
          virtual_token_reserves: number | null
          volume_24h_sol: number | null
          website_url: string | null
        }
        Insert: {
          api_account_id?: string | null
          bonding_curve_progress?: number | null
          claim_locked_at?: string | null
          created_at?: string | null
          creator_fee_bps?: number | null
          creator_id?: string | null
          creator_wallet: string
          damm_pool_address?: string | null
          dbc_pool_address?: string | null
          description?: string | null
          discord_url?: string | null
          graduated_at?: string | null
          graduation_threshold_sol?: number | null
          holder_count?: number | null
          id?: string
          image_url?: string | null
          last_claim_at?: string | null
          market_cap_sol?: number | null
          migration_status?: string | null
          mint_address: string
          name: string
          price_24h_ago?: number | null
          price_change_24h?: number | null
          price_sol?: number | null
          quote_decimals?: number | null
          quote_token?: string | null
          real_sol_reserves?: number | null
          real_token_reserves?: number | null
          status?: string | null
          system_fee_bps?: number | null
          system_unclaimed_sol?: number | null
          telegram_url?: string | null
          ticker: string
          total_supply?: number | null
          twitter_url?: string | null
          updated_at?: string | null
          virtual_sol_reserves?: number | null
          virtual_token_reserves?: number | null
          volume_24h_sol?: number | null
          website_url?: string | null
        }
        Update: {
          api_account_id?: string | null
          bonding_curve_progress?: number | null
          claim_locked_at?: string | null
          created_at?: string | null
          creator_fee_bps?: number | null
          creator_id?: string | null
          creator_wallet?: string
          damm_pool_address?: string | null
          dbc_pool_address?: string | null
          description?: string | null
          discord_url?: string | null
          graduated_at?: string | null
          graduation_threshold_sol?: number | null
          holder_count?: number | null
          id?: string
          image_url?: string | null
          last_claim_at?: string | null
          market_cap_sol?: number | null
          migration_status?: string | null
          mint_address?: string
          name?: string
          price_24h_ago?: number | null
          price_change_24h?: number | null
          price_sol?: number | null
          quote_decimals?: number | null
          quote_token?: string | null
          real_sol_reserves?: number | null
          real_token_reserves?: number | null
          status?: string | null
          system_fee_bps?: number | null
          system_unclaimed_sol?: number | null
          telegram_url?: string | null
          ticker?: string
          total_supply?: number | null
          twitter_url?: string | null
          updated_at?: string | null
          virtual_sol_reserves?: number | null
          virtual_token_reserves?: number | null
          volume_24h_sol?: number | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tokens_api_account_id_fkey"
            columns: ["api_account_id"]
            isOneToOne: false
            referencedRelation: "api_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tokens_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tracked_wallets: {
        Row: {
          copy_amount_sol: number | null
          copy_percentage: number | null
          created_at: string
          id: string
          is_copy_trading_enabled: boolean
          max_per_trade_sol: number | null
          notifications_enabled: boolean
          total_pnl_sol: number | null
          trades_copied: number | null
          updated_at: string
          user_profile_id: string
          wallet_address: string
          wallet_label: string | null
        }
        Insert: {
          copy_amount_sol?: number | null
          copy_percentage?: number | null
          created_at?: string
          id?: string
          is_copy_trading_enabled?: boolean
          max_per_trade_sol?: number | null
          notifications_enabled?: boolean
          total_pnl_sol?: number | null
          trades_copied?: number | null
          updated_at?: string
          user_profile_id: string
          wallet_address: string
          wallet_label?: string | null
        }
        Update: {
          copy_amount_sol?: number | null
          copy_percentage?: number | null
          created_at?: string
          id?: string
          is_copy_trading_enabled?: boolean
          max_per_trade_sol?: number | null
          notifications_enabled?: boolean
          total_pnl_sol?: number | null
          trades_copied?: number | null
          updated_at?: string
          user_profile_id?: string
          wallet_address?: string
          wallet_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracked_wallets_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_agent_fee_deposits: {
        Row: {
          amount_sol: number
          created_at: string | null
          id: string
          signature: string | null
          source: string | null
          trading_agent_id: string
        }
        Insert: {
          amount_sol: number
          created_at?: string | null
          id?: string
          signature?: string | null
          source?: string | null
          trading_agent_id: string
        }
        Update: {
          amount_sol?: number
          created_at?: string | null
          id?: string
          signature?: string | null
          source?: string | null
          trading_agent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trading_agent_fee_deposits_trading_agent_id_fkey"
            columns: ["trading_agent_id"]
            isOneToOne: false
            referencedRelation: "trading_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_agent_positions: {
        Row: {
          amount_tokens: number
          closed_at: string | null
          current_price_sol: number | null
          current_value_sol: number | null
          entry_narrative: string | null
          entry_price_sol: number
          entry_reason: string | null
          exit_reason: string | null
          id: string
          investment_sol: number
          limit_order_sl_pubkey: string | null
          limit_order_sl_status: string | null
          limit_order_tp_pubkey: string | null
          limit_order_tp_status: string | null
          market_conditions: string | null
          opened_at: string | null
          realized_pnl_sol: number | null
          risk_assessment: string | null
          status: string | null
          stop_loss_price_sol: number | null
          strategy_adjustments: string | null
          target_price_sol: number | null
          token_address: string
          token_image_url: string | null
          token_name: string | null
          token_symbol: string | null
          trading_agent_id: string
          trailing_stop_active: boolean | null
          unrealized_pnl_pct: number | null
          unrealized_pnl_sol: number | null
        }
        Insert: {
          amount_tokens: number
          closed_at?: string | null
          current_price_sol?: number | null
          current_value_sol?: number | null
          entry_narrative?: string | null
          entry_price_sol: number
          entry_reason?: string | null
          exit_reason?: string | null
          id?: string
          investment_sol: number
          limit_order_sl_pubkey?: string | null
          limit_order_sl_status?: string | null
          limit_order_tp_pubkey?: string | null
          limit_order_tp_status?: string | null
          market_conditions?: string | null
          opened_at?: string | null
          realized_pnl_sol?: number | null
          risk_assessment?: string | null
          status?: string | null
          stop_loss_price_sol?: number | null
          strategy_adjustments?: string | null
          target_price_sol?: number | null
          token_address: string
          token_image_url?: string | null
          token_name?: string | null
          token_symbol?: string | null
          trading_agent_id: string
          trailing_stop_active?: boolean | null
          unrealized_pnl_pct?: number | null
          unrealized_pnl_sol?: number | null
        }
        Update: {
          amount_tokens?: number
          closed_at?: string | null
          current_price_sol?: number | null
          current_value_sol?: number | null
          entry_narrative?: string | null
          entry_price_sol?: number
          entry_reason?: string | null
          exit_reason?: string | null
          id?: string
          investment_sol?: number
          limit_order_sl_pubkey?: string | null
          limit_order_sl_status?: string | null
          limit_order_tp_pubkey?: string | null
          limit_order_tp_status?: string | null
          market_conditions?: string | null
          opened_at?: string | null
          realized_pnl_sol?: number | null
          risk_assessment?: string | null
          status?: string | null
          stop_loss_price_sol?: number | null
          strategy_adjustments?: string | null
          target_price_sol?: number | null
          token_address?: string
          token_image_url?: string | null
          token_name?: string | null
          token_symbol?: string | null
          trading_agent_id?: string
          trailing_stop_active?: boolean | null
          unrealized_pnl_pct?: number | null
          unrealized_pnl_sol?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trading_agent_positions_trading_agent_id_fkey"
            columns: ["trading_agent_id"]
            isOneToOne: false
            referencedRelation: "trading_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_agent_strategy_reviews: {
        Row: {
          confidence_level: number | null
          created_at: string | null
          deprecated_rules: string[] | null
          id: string
          key_insights: string | null
          new_rules: string[] | null
          review_type: string
          strategy_adjustments: string | null
          total_pnl_at_review: number | null
          trades_analyzed: number | null
          trading_agent_id: string
          win_rate_at_review: number | null
        }
        Insert: {
          confidence_level?: number | null
          created_at?: string | null
          deprecated_rules?: string[] | null
          id?: string
          key_insights?: string | null
          new_rules?: string[] | null
          review_type?: string
          strategy_adjustments?: string | null
          total_pnl_at_review?: number | null
          trades_analyzed?: number | null
          trading_agent_id: string
          win_rate_at_review?: number | null
        }
        Update: {
          confidence_level?: number | null
          created_at?: string | null
          deprecated_rules?: string[] | null
          id?: string
          key_insights?: string | null
          new_rules?: string[] | null
          review_type?: string
          strategy_adjustments?: string | null
          total_pnl_at_review?: number | null
          trades_analyzed?: number | null
          trading_agent_id?: string
          win_rate_at_review?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trading_agent_strategy_reviews_trading_agent_id_fkey"
            columns: ["trading_agent_id"]
            isOneToOne: false
            referencedRelation: "trading_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_agent_trades: {
        Row: {
          ai_reasoning: string | null
          amount_sol: number
          amount_tokens: number
          buy_signature: string | null
          confidence_score: number | null
          created_at: string | null
          entry_analysis: string | null
          error_message: string | null
          execution_time_ms: number | null
          exit_analysis: string | null
          id: string
          lessons_learned: string | null
          market_context: string | null
          narrative_match: string | null
          position_id: string | null
          price_per_token: number
          signature: string | null
          slippage_actual: number | null
          status: string | null
          strategy_used: string | null
          subtuna_post_id: string | null
          token_address: string
          token_name: string | null
          token_score: number | null
          trade_type: string
          trading_agent_id: string
          verified_at: string | null
          verified_pnl_sol: number | null
        }
        Insert: {
          ai_reasoning?: string | null
          amount_sol: number
          amount_tokens: number
          buy_signature?: string | null
          confidence_score?: number | null
          created_at?: string | null
          entry_analysis?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          exit_analysis?: string | null
          id?: string
          lessons_learned?: string | null
          market_context?: string | null
          narrative_match?: string | null
          position_id?: string | null
          price_per_token: number
          signature?: string | null
          slippage_actual?: number | null
          status?: string | null
          strategy_used?: string | null
          subtuna_post_id?: string | null
          token_address: string
          token_name?: string | null
          token_score?: number | null
          trade_type: string
          trading_agent_id: string
          verified_at?: string | null
          verified_pnl_sol?: number | null
        }
        Update: {
          ai_reasoning?: string | null
          amount_sol?: number
          amount_tokens?: number
          buy_signature?: string | null
          confidence_score?: number | null
          created_at?: string | null
          entry_analysis?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          exit_analysis?: string | null
          id?: string
          lessons_learned?: string | null
          market_context?: string | null
          narrative_match?: string | null
          position_id?: string | null
          price_per_token?: number
          signature?: string | null
          slippage_actual?: number | null
          status?: string | null
          strategy_used?: string | null
          subtuna_post_id?: string | null
          token_address?: string
          token_name?: string | null
          token_score?: number | null
          trade_type?: string
          trading_agent_id?: string
          verified_at?: string | null
          verified_pnl_sol?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trading_agent_trades_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "trading_agent_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_agent_trades_subtuna_post_id_fkey"
            columns: ["subtuna_post_id"]
            isOneToOne: false
            referencedRelation: "subtuna_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_agent_trades_trading_agent_id_fkey"
            columns: ["trading_agent_id"]
            isOneToOne: false
            referencedRelation: "trading_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_agents: {
        Row: {
          agent_id: string | null
          avatar_url: string | null
          avg_hold_time_minutes: number | null
          avoided_patterns: string[] | null
          best_trade_sol: number | null
          consecutive_losses: number | null
          consecutive_wins: number | null
          created_at: string | null
          creator_profile_id: string | null
          creator_wallet: string | null
          description: string | null
          fun_token_id: string | null
          id: string
          last_deposit_at: string | null
          last_strategy_review: string | null
          last_trade_at: string | null
          learned_patterns: Json | null
          losing_trades: number | null
          max_concurrent_positions: number | null
          max_position_size_sol: number | null
          mint_address: string | null
          name: string
          preferred_narratives: string[] | null
          status: string | null
          stop_loss_pct: number | null
          strategy_notes: string | null
          strategy_type: string | null
          take_profit_pct: number | null
          ticker: string
          total_invested_sol: number | null
          total_profit_sol: number | null
          total_trades: number | null
          trading_capital_sol: number | null
          trading_style: string | null
          twitter_url: string | null
          unrealized_pnl_sol: number | null
          updated_at: string | null
          wallet_address: string
          wallet_private_key_backup: string | null
          wallet_private_key_encrypted: string
          win_rate: number | null
          winning_trades: number | null
          worst_trade_sol: number | null
        }
        Insert: {
          agent_id?: string | null
          avatar_url?: string | null
          avg_hold_time_minutes?: number | null
          avoided_patterns?: string[] | null
          best_trade_sol?: number | null
          consecutive_losses?: number | null
          consecutive_wins?: number | null
          created_at?: string | null
          creator_profile_id?: string | null
          creator_wallet?: string | null
          description?: string | null
          fun_token_id?: string | null
          id?: string
          last_deposit_at?: string | null
          last_strategy_review?: string | null
          last_trade_at?: string | null
          learned_patterns?: Json | null
          losing_trades?: number | null
          max_concurrent_positions?: number | null
          max_position_size_sol?: number | null
          mint_address?: string | null
          name: string
          preferred_narratives?: string[] | null
          status?: string | null
          stop_loss_pct?: number | null
          strategy_notes?: string | null
          strategy_type?: string | null
          take_profit_pct?: number | null
          ticker: string
          total_invested_sol?: number | null
          total_profit_sol?: number | null
          total_trades?: number | null
          trading_capital_sol?: number | null
          trading_style?: string | null
          twitter_url?: string | null
          unrealized_pnl_sol?: number | null
          updated_at?: string | null
          wallet_address: string
          wallet_private_key_backup?: string | null
          wallet_private_key_encrypted: string
          win_rate?: number | null
          winning_trades?: number | null
          worst_trade_sol?: number | null
        }
        Update: {
          agent_id?: string | null
          avatar_url?: string | null
          avg_hold_time_minutes?: number | null
          avoided_patterns?: string[] | null
          best_trade_sol?: number | null
          consecutive_losses?: number | null
          consecutive_wins?: number | null
          created_at?: string | null
          creator_profile_id?: string | null
          creator_wallet?: string | null
          description?: string | null
          fun_token_id?: string | null
          id?: string
          last_deposit_at?: string | null
          last_strategy_review?: string | null
          last_trade_at?: string | null
          learned_patterns?: Json | null
          losing_trades?: number | null
          max_concurrent_positions?: number | null
          max_position_size_sol?: number | null
          mint_address?: string | null
          name?: string
          preferred_narratives?: string[] | null
          status?: string | null
          stop_loss_pct?: number | null
          strategy_notes?: string | null
          strategy_type?: string | null
          take_profit_pct?: number | null
          ticker?: string
          total_invested_sol?: number | null
          total_profit_sol?: number | null
          total_trades?: number | null
          trading_capital_sol?: number | null
          trading_style?: string | null
          twitter_url?: string | null
          unrealized_pnl_sol?: number | null
          updated_at?: string | null
          wallet_address?: string
          wallet_private_key_backup?: string | null
          wallet_private_key_encrypted?: string
          win_rate?: number | null
          winning_trades?: number | null
          worst_trade_sol?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trading_agents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_agents_creator_profile_id_fkey"
            columns: ["creator_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_agents_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_fee_claims: {
        Row: {
          claimed_at: string | null
          claimed_sol: number
          id: string
          is_registered: boolean | null
          mint_address: string | null
          pool_address: string
          signature: string | null
          token_name: string | null
        }
        Insert: {
          claimed_at?: string | null
          claimed_sol?: number
          id?: string
          is_registered?: boolean | null
          mint_address?: string | null
          pool_address: string
          signature?: string | null
          token_name?: string | null
        }
        Update: {
          claimed_at?: string | null
          claimed_sol?: number
          id?: string
          is_registered?: boolean | null
          mint_address?: string | null
          pool_address?: string
          signature?: string | null
          token_name?: string | null
        }
        Relationships: []
      }
      treasury_pool_cache: {
        Row: {
          claimable_sol: number | null
          discovered_at: string | null
          is_registered: boolean | null
          last_checked_at: string | null
          mint_address: string | null
          pool_address: string
          registered_in: string | null
          token_name: string | null
        }
        Insert: {
          claimable_sol?: number | null
          discovered_at?: string | null
          is_registered?: boolean | null
          last_checked_at?: string | null
          mint_address?: string | null
          pool_address: string
          registered_in?: string | null
          token_name?: string | null
        }
        Update: {
          claimable_sol?: number | null
          discovered_at?: string | null
          is_registered?: boolean | null
          last_checked_at?: string | null
          mint_address?: string | null
          pool_address?: string
          registered_in?: string | null
          token_name?: string | null
        }
        Relationships: []
      }
      trending_narratives: {
        Row: {
          analyzed_at: string
          created_at: string
          description: string | null
          example_tokens: string[] | null
          id: string
          is_active: boolean
          narrative: string
          popularity_score: number
          token_count: number
        }
        Insert: {
          analyzed_at?: string
          created_at?: string
          description?: string | null
          example_tokens?: string[] | null
          id?: string
          is_active?: boolean
          narrative: string
          popularity_score?: number
          token_count?: number
        }
        Update: {
          analyzed_at?: string
          created_at?: string
          description?: string | null
          example_tokens?: string[] | null
          id?: string
          is_active?: boolean
          narrative?: string
          popularity_score?: number
          token_count?: number
        }
        Relationships: []
      }
      trending_tokens: {
        Row: {
          amount: number | null
          chain_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string | null
          rank: number
          symbol: string | null
          synced_at: string
          token_address: string
          total_amount: number | null
          url: string | null
        }
        Insert: {
          amount?: number | null
          chain_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string | null
          rank: number
          symbol?: string | null
          synced_at?: string
          token_address: string
          total_amount?: number | null
          url?: string | null
        }
        Update: {
          amount?: number | null
          chain_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string | null
          rank?: number
          symbol?: string | null
          synced_at?: string
          token_address?: string
          total_amount?: number | null
          url?: string | null
        }
        Relationships: []
      }
      trending_topics: {
        Row: {
          calculated_at: string | null
          category: string | null
          hashtag_id: string | null
          id: string
          post_count_1h: number | null
          post_count_24h: number | null
          rank: number | null
          score: number
          velocity: number | null
        }
        Insert: {
          calculated_at?: string | null
          category?: string | null
          hashtag_id?: string | null
          id?: string
          post_count_1h?: number | null
          post_count_24h?: number | null
          rank?: number | null
          score?: number
          velocity?: number | null
        }
        Update: {
          calculated_at?: string | null
          category?: string | null
          hashtag_id?: string | null
          id?: string
          post_count_1h?: number | null
          post_count_24h?: number | null
          rank?: number | null
          score?: number
          velocity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trending_topics_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["id"]
          },
        ]
      }
      tuna_migration_config: {
        Row: {
          collection_wallet: string
          created_at: string
          deadline_at: string
          id: string
          old_mint_address: string
          total_supply_snapshot: number | null
        }
        Insert: {
          collection_wallet: string
          created_at?: string
          deadline_at: string
          id?: string
          old_mint_address: string
          total_supply_snapshot?: number | null
        }
        Update: {
          collection_wallet?: string
          created_at?: string
          deadline_at?: string
          id?: string
          old_mint_address?: string
          total_supply_snapshot?: number | null
        }
        Relationships: []
      }
      tuna_migration_ledger: {
        Row: {
          created_at: string
          first_transfer_at: string | null
          id: string
          last_scanned_at: string | null
          last_transfer_at: string | null
          total_tokens_received: number
          tx_count: number
          wallet_address: string
        }
        Insert: {
          created_at?: string
          first_transfer_at?: string | null
          id?: string
          last_scanned_at?: string | null
          last_transfer_at?: string | null
          total_tokens_received?: number
          tx_count?: number
          wallet_address: string
        }
        Update: {
          created_at?: string
          first_transfer_at?: string | null
          id?: string
          last_scanned_at?: string | null
          last_transfer_at?: string | null
          total_tokens_received?: number
          tx_count?: number
          wallet_address?: string
        }
        Relationships: []
      }
      tuna_migration_snapshot: {
        Row: {
          amount_sent: number | null
          created_at: string
          has_migrated: boolean
          id: string
          migrated_at: string | null
          supply_percentage: number
          token_balance: number
          tx_signature: string | null
          wallet_address: string
        }
        Insert: {
          amount_sent?: number | null
          created_at?: string
          has_migrated?: boolean
          id?: string
          migrated_at?: string | null
          supply_percentage?: number
          token_balance?: number
          tx_signature?: string | null
          wallet_address: string
        }
        Update: {
          amount_sent?: number | null
          created_at?: string
          has_migrated?: boolean
          id?: string
          migrated_at?: string | null
          supply_percentage?: number
          token_balance?: number
          tx_signature?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      tuna_migration_transactions: {
        Row: {
          amount_sent: number
          created_at: string
          id: string
          tx_signature: string
          verified_at: string
          wallet_address: string
        }
        Insert: {
          amount_sent?: number
          created_at?: string
          id?: string
          tx_signature: string
          verified_at?: string
          wallet_address: string
        }
        Update: {
          amount_sent?: number
          created_at?: string
          id?: string
          tx_signature?: string
          verified_at?: string
          wallet_address?: string
        }
        Relationships: []
      }
      tunnel_distribution_runs: {
        Row: {
          amount_per_wallet: number
          completed_at: string | null
          created_at: string
          hops: Json
          id: string
          source_wallet: string
          status: string
          tunnel_keys: Json
        }
        Insert: {
          amount_per_wallet: number
          completed_at?: string | null
          created_at?: string
          hops?: Json
          id?: string
          source_wallet: string
          status?: string
          tunnel_keys?: Json
        }
        Update: {
          amount_per_wallet?: number
          completed_at?: string | null
          created_at?: string
          hops?: Json
          id?: string
          source_wallet?: string
          status?: string
          tunnel_keys?: Json
        }
        Relationships: []
      }
      twitter_bot_replies: {
        Row: {
          created_at: string
          id: string
          reply_id: string | null
          reply_text: string
          tweet_author: string | null
          tweet_id: string
          tweet_text: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          reply_id?: string | null
          reply_text: string
          tweet_author?: string | null
          tweet_id: string
          tweet_text?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          reply_id?: string | null
          reply_text?: string
          tweet_author?: string | null
          tweet_id?: string
          tweet_text?: string | null
        }
        Relationships: []
      }
      twitter_profile_cache: {
        Row: {
          profile_image_url: string | null
          updated_at: string | null
          username: string
          verified: boolean | null
          verified_type: string | null
        }
        Insert: {
          profile_image_url?: string | null
          updated_at?: string | null
          username: string
          verified?: boolean | null
          verified_type?: string | null
        }
        Update: {
          profile_image_url?: string | null
          updated_at?: string | null
          username?: string
          verified?: boolean | null
          verified_type?: string | null
        }
        Relationships: []
      }
      twitter_style_library: {
        Row: {
          created_at: string
          id: string
          learned_at: string
          tweet_count: number
          twitter_user_id: string | null
          twitter_username: string
          updated_at: string
          usage_count: number
          writing_style: Json
        }
        Insert: {
          created_at?: string
          id?: string
          learned_at?: string
          tweet_count?: number
          twitter_user_id?: string | null
          twitter_username: string
          updated_at?: string
          usage_count?: number
          writing_style: Json
        }
        Update: {
          created_at?: string
          id?: string
          learned_at?: string
          tweet_count?: number
          twitter_user_id?: string | null
          twitter_username?: string
          updated_at?: string
          usage_count?: number
          writing_style?: Json
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          api_key_encrypted: string
          api_secret_encrypted: string
          created_at: string
          exchange: string
          id: string
          label: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          api_key_encrypted: string
          api_secret_encrypted: string
          created_at?: string
          exchange?: string
          id?: string
          label?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          api_key_encrypted?: string
          api_secret_encrypted?: string
          created_at?: string
          exchange?: string
          id?: string
          label?: string | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_bans: {
        Row: {
          associated_ips: string[] | null
          banned_by: string
          created_at: string
          expires_at: string | null
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          associated_ips?: string[] | null
          banned_by: string
          created_at?: string
          expires_at?: string | null
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          associated_ips?: string[] | null
          banned_by?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_user_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          blocked_user_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          blocked_user_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_ip_logs: {
        Row: {
          first_seen_at: string
          id: string
          ip_address: string
          last_seen_at: string
          request_count: number | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          first_seen_at?: string
          id?: string
          ip_address: string
          last_seen_at?: string
          request_count?: number | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          first_seen_at?: string
          id?: string
          ip_address?: string
          last_seen_at?: string
          request_count?: number | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_mutes: {
        Row: {
          created_at: string
          id: string
          muted_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          muted_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          muted_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_wallets: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          label: string
          profile_id: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          profile_id: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          profile_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_wallets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vanity_keypairs: {
        Row: {
          created_at: string
          id: string
          public_key: string
          secret_key_encrypted: string
          status: string
          suffix: string
          used_for_token_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          public_key: string
          secret_key_encrypted: string
          status?: string
          suffix: string
          used_for_token_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          public_key?: string
          secret_key_encrypted?: string
          status?: string
          suffix?: string
          used_for_token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vanity_keypairs_used_for_token_id_fkey"
            columns: ["used_for_token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      visitor_sessions: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          session_id?: string
        }
        Relationships: []
      }
      wallet_trades: {
        Row: {
          copied_by_count: number | null
          created_at: string
          id: string
          price_per_token: number
          signature: string
          slot: number | null
          sol_amount: number
          token_amount: number
          token_image_url: string | null
          token_mint: string
          token_name: string | null
          token_ticker: string | null
          tracked_wallet_id: string | null
          trade_type: string
          wallet_address: string
        }
        Insert: {
          copied_by_count?: number | null
          created_at?: string
          id?: string
          price_per_token: number
          signature: string
          slot?: number | null
          sol_amount: number
          token_amount: number
          token_image_url?: string | null
          token_mint: string
          token_name?: string | null
          token_ticker?: string | null
          tracked_wallet_id?: string | null
          trade_type: string
          wallet_address: string
        }
        Update: {
          copied_by_count?: number | null
          created_at?: string
          id?: string
          price_per_token?: number
          signature?: string
          slot?: number | null
          sol_amount?: number
          token_amount?: number
          token_image_url?: string | null
          token_mint?: string
          token_name?: string | null
          token_ticker?: string | null
          tracked_wallet_id?: string | null
          trade_type?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_trades_tracked_wallet_id_fkey"
            columns: ["tracked_wallet_id"]
            isOneToOne: false
            referencedRelation: "tracked_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      whale_addresses: {
        Row: {
          activity_types: string[]
          address: string
          created_at: string
          id: string
          last_seen_at: string
          session_id: string
          sources: string[]
          times_seen: number
          total_volume_sol: number
        }
        Insert: {
          activity_types?: string[]
          address: string
          created_at?: string
          id?: string
          last_seen_at?: string
          session_id: string
          sources?: string[]
          times_seen?: number
          total_volume_sol?: number
        }
        Update: {
          activity_types?: string[]
          address?: string
          created_at?: string
          id?: string
          last_seen_at?: string
          session_id?: string
          sources?: string[]
          times_seen?: number
          total_volume_sol?: number
        }
        Relationships: [
          {
            foreignKeyName: "whale_addresses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whale_scan_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      whale_scan_sessions: {
        Row: {
          credits_used: number
          error_count: number
          expires_at: string
          id: string
          last_error: string | null
          last_poll_at: string | null
          last_slot: number | null
          min_sol: number
          slots_per_call: number
          started_at: string
          status: string
          total_slots_scanned: number
          total_swaps: number
          total_transfers: number
          total_volume: number
        }
        Insert: {
          credits_used?: number
          error_count?: number
          expires_at?: string
          id?: string
          last_error?: string | null
          last_poll_at?: string | null
          last_slot?: number | null
          min_sol?: number
          slots_per_call?: number
          started_at?: string
          status?: string
          total_slots_scanned?: number
          total_swaps?: number
          total_transfers?: number
          total_volume?: number
        }
        Update: {
          credits_used?: number
          error_count?: number
          expires_at?: string
          id?: string
          last_error?: string | null
          last_poll_at?: string | null
          last_slot?: number | null
          min_sol?: number
          slots_per_call?: number
          started_at?: string
          status?: string
          total_slots_scanned?: number
          total_swaps?: number
          total_transfers?: number
          total_volume?: number
        }
        Relationships: []
      }
      x_bot_account_logs: {
        Row: {
          account_id: string
          created_at: string
          details: Json | null
          id: string
          level: string
          log_type: string
          message: string
        }
        Insert: {
          account_id: string
          created_at?: string
          details?: Json | null
          id?: string
          level?: string
          log_type: string
          message: string
        }
        Update: {
          account_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          level?: string
          log_type?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "x_bot_account_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "x_bot_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      x_bot_account_queue: {
        Row: {
          account_id: string | null
          conversation_id: string | null
          created_at: string | null
          follower_count: number | null
          id: string
          is_verified: boolean | null
          match_type: string | null
          processed_at: string | null
          status: string | null
          tweet_author: string | null
          tweet_author_id: string | null
          tweet_id: string
          tweet_text: string | null
        }
        Insert: {
          account_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          follower_count?: number | null
          id?: string
          is_verified?: boolean | null
          match_type?: string | null
          processed_at?: string | null
          status?: string | null
          tweet_author?: string | null
          tweet_author_id?: string | null
          tweet_id: string
          tweet_text?: string | null
        }
        Update: {
          account_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          follower_count?: number | null
          id?: string
          is_verified?: boolean | null
          match_type?: string | null
          processed_at?: string | null
          status?: string | null
          tweet_author?: string | null
          tweet_author_id?: string | null
          tweet_id?: string
          tweet_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "x_bot_account_queue_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "x_bot_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      x_bot_account_replies: {
        Row: {
          account_id: string | null
          conversation_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          reply_id: string | null
          reply_text: string | null
          reply_type: string | null
          status: string | null
          tweet_author: string | null
          tweet_author_id: string | null
          tweet_id: string
          tweet_text: string | null
        }
        Insert: {
          account_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          reply_id?: string | null
          reply_text?: string | null
          reply_type?: string | null
          status?: string | null
          tweet_author?: string | null
          tweet_author_id?: string | null
          tweet_id: string
          tweet_text?: string | null
        }
        Update: {
          account_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          reply_id?: string | null
          reply_text?: string | null
          reply_type?: string | null
          status?: string | null
          tweet_author?: string | null
          tweet_author_id?: string | null
          tweet_id?: string
          tweet_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "x_bot_account_replies_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "x_bot_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      x_bot_account_rules: {
        Row: {
          account_id: string | null
          author_cooldown_hours: number | null
          author_cooldown_minutes: number | null
          created_at: string | null
          enabled: boolean | null
          id: string
          max_replies_per_thread: number | null
          min_follower_count: number | null
          monitored_mentions: string[] | null
          persona_prompt: string | null
          require_blue_verified: boolean | null
          require_gold_verified: boolean | null
          tracked_cashtags: string[] | null
          tracked_keywords: string[] | null
        }
        Insert: {
          account_id?: string | null
          author_cooldown_hours?: number | null
          author_cooldown_minutes?: number | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          max_replies_per_thread?: number | null
          min_follower_count?: number | null
          monitored_mentions?: string[] | null
          persona_prompt?: string | null
          require_blue_verified?: boolean | null
          require_gold_verified?: boolean | null
          tracked_cashtags?: string[] | null
          tracked_keywords?: string[] | null
        }
        Update: {
          account_id?: string | null
          author_cooldown_hours?: number | null
          author_cooldown_minutes?: number | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          max_replies_per_thread?: number | null
          min_follower_count?: number | null
          monitored_mentions?: string[] | null
          persona_prompt?: string | null
          require_blue_verified?: boolean | null
          require_gold_verified?: boolean | null
          tracked_cashtags?: string[] | null
          tracked_keywords?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "x_bot_account_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "x_bot_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      x_bot_accounts: {
        Row: {
          auth_token_encrypted: string | null
          created_at: string | null
          ct0_token_encrypted: string | null
          current_socks5_index: number | null
          email: string | null
          full_cookie_encrypted: string | null
          id: string
          is_active: boolean | null
          last_scanned_at: string | null
          last_socks5_failure_at: string | null
          name: string
          password_encrypted: string | null
          proxy_url: string | null
          socks5_urls: string[] | null
          subtuna_ticker: string | null
          totp_secret_encrypted: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          auth_token_encrypted?: string | null
          created_at?: string | null
          ct0_token_encrypted?: string | null
          current_socks5_index?: number | null
          email?: string | null
          full_cookie_encrypted?: string | null
          id?: string
          is_active?: boolean | null
          last_scanned_at?: string | null
          last_socks5_failure_at?: string | null
          name: string
          password_encrypted?: string | null
          proxy_url?: string | null
          socks5_urls?: string[] | null
          subtuna_ticker?: string | null
          totp_secret_encrypted?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          auth_token_encrypted?: string | null
          created_at?: string | null
          ct0_token_encrypted?: string | null
          current_socks5_index?: number | null
          email?: string | null
          full_cookie_encrypted?: string | null
          id?: string
          is_active?: boolean | null
          last_scanned_at?: string | null
          last_socks5_failure_at?: string | null
          name?: string
          password_encrypted?: string | null
          proxy_url?: string | null
          socks5_urls?: string[] | null
          subtuna_ticker?: string | null
          totp_secret_encrypted?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      x_bot_conversation_history: {
        Row: {
          account_id: string
          conversation_id: string | null
          created_at: string
          extracted_topics: string[] | null
          id: string
          incoming_text: string
          reply_text: string | null
          tweet_author_id: string
          tweet_author_username: string | null
          tweet_id: string | null
        }
        Insert: {
          account_id: string
          conversation_id?: string | null
          created_at?: string
          extracted_topics?: string[] | null
          id?: string
          incoming_text: string
          reply_text?: string | null
          tweet_author_id: string
          tweet_author_username?: string | null
          tweet_id?: string | null
        }
        Update: {
          account_id?: string
          conversation_id?: string | null
          created_at?: string
          extracted_topics?: string[] | null
          id?: string
          incoming_text?: string
          reply_text?: string | null
          tweet_author_id?: string
          tweet_author_username?: string | null
          tweet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "x_bot_conversation_history_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "x_bot_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      x_bot_rate_limits: {
        Row: {
          id: string
          launched_at: string
          x_user_id: string
          x_username: string | null
        }
        Insert: {
          id?: string
          launched_at?: string
          x_user_id: string
          x_username?: string | null
        }
        Update: {
          id?: string
          launched_at?: string
          x_user_id?: string
          x_username?: string | null
        }
        Relationships: []
      }
      x_bot_user_topics: {
        Row: {
          account_id: string
          ask_count: number
          first_asked_at: string
          id: string
          last_asked_at: string
          topic: string
          tweet_author_id: string
          tweet_author_username: string | null
        }
        Insert: {
          account_id: string
          ask_count?: number
          first_asked_at?: string
          id?: string
          last_asked_at?: string
          topic: string
          tweet_author_id: string
          tweet_author_username?: string | null
        }
        Update: {
          account_id?: string
          ask_count?: number
          first_asked_at?: string
          id?: string
          last_asked_at?: string
          topic?: string
          tweet_author_id?: string
          tweet_author_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "x_bot_user_topics_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "x_bot_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      x_follower_scans: {
        Row: {
          created_at: string
          created_at_twitter: string | null
          description: string | null
          display_name: string | null
          follower_count: number | null
          following_count: number | null
          id: string
          is_blue_verified: boolean | null
          is_gold_verified: boolean | null
          location: string | null
          profile_picture: string | null
          scanned_at: string | null
          statuses_count: number | null
          target_username: string
          twitter_user_id: string
          username: string | null
          verification_type: string
        }
        Insert: {
          created_at?: string
          created_at_twitter?: string | null
          description?: string | null
          display_name?: string | null
          follower_count?: number | null
          following_count?: number | null
          id?: string
          is_blue_verified?: boolean | null
          is_gold_verified?: boolean | null
          location?: string | null
          profile_picture?: string | null
          scanned_at?: string | null
          statuses_count?: number | null
          target_username: string
          twitter_user_id: string
          username?: string | null
          verification_type?: string
        }
        Update: {
          created_at?: string
          created_at_twitter?: string | null
          description?: string | null
          display_name?: string | null
          follower_count?: number | null
          following_count?: number | null
          id?: string
          is_blue_verified?: boolean | null
          is_gold_verified?: boolean | null
          location?: string | null
          profile_picture?: string | null
          scanned_at?: string | null
          statuses_count?: number | null
          target_username?: string
          twitter_user_id?: string
          username?: string | null
          verification_type?: string
        }
        Relationships: []
      }
      x_launch_events: {
        Row: {
          created_at: string
          details: Json | null
          error_message: string | null
          id: string
          platform: string
          post_author: string | null
          post_id: string
          stage: string
          success: boolean
        }
        Insert: {
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          platform?: string
          post_author?: string | null
          post_id: string
          stage: string
          success?: boolean
        }
        Update: {
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          platform?: string
          post_author?: string | null
          post_id?: string
          stage?: string
          success?: boolean
        }
        Relationships: []
      }
      x_pending_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          original_tweet_image_url: string | null
          original_tweet_text: string | null
          our_reply_tweet_id: string | null
          status: string
          tweet_id: string
          x_user_id: string
          x_username: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          original_tweet_image_url?: string | null
          original_tweet_text?: string | null
          our_reply_tweet_id?: string | null
          status?: string
          tweet_id: string
          x_user_id: string
          x_username?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          original_tweet_image_url?: string | null
          original_tweet_text?: string | null
          our_reply_tweet_id?: string | null
          status?: string
          tweet_id?: string
          x_user_id?: string
          x_username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      admin_reports_view: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          post_author_username: string | null
          post_content: string | null
          reason: string | null
          reported_display_name: string | null
          reported_post_id: string | null
          reported_user_id: string | null
          reported_username: string | null
          reporter_display_name: string | null
          reporter_id: string | null
          reporter_username: string | null
          status: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      ai_usage_daily: {
        Row: {
          agent_id: string | null
          avg_latency_ms: number | null
          day: string | null
          rate_limit_count: number | null
          request_count: number | null
          request_type: string | null
          success_count: number | null
          total_input_tokens: number | null
          total_output_tokens: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_request_log_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      acquire_claim_lock: {
        Args: { p_lock_duration_seconds?: number; p_token_id: string }
        Returns: boolean
      }
      acquire_claw_creator_claim_lock: {
        Args: { p_duration_seconds?: number; p_twitter_username: string }
        Returns: boolean
      }
      acquire_creator_claim_lock: {
        Args: { p_duration_seconds?: number; p_twitter_username: string }
        Returns: boolean
      }
      admin_delete_comment: { Args: { _comment_id: string }; Returns: boolean }
      admin_delete_post: { Args: { _post_id: string }; Returns: boolean }
      admin_resolve_report: {
        Args: { _notes?: string; _report_id: string; _status: string }
        Returns: boolean
      }
      admin_set_moderator: {
        Args: { _is_mod: boolean; _subtuna_id: string; _user_id: string }
        Returns: boolean
      }
      admin_toggle_lock_post: { Args: { _post_id: string }; Returns: boolean }
      admin_toggle_pin_post: { Args: { _post_id: string }; Returns: boolean }
      backend_acquire_launch_lock: {
        Args: {
          p_creator_wallet: string
          p_idempotency_key: string
          p_ticker: string
        }
        Returns: Json
      }
      backend_attribute_token_to_api: {
        Args: { p_api_account_id: string; p_token_id: string }
        Returns: boolean
      }
      backend_close_trading_position: {
        Args: {
          p_exit_price_sol: number
          p_exit_reason: string
          p_position_id: string
          p_status?: string
        }
        Returns: undefined
      }
      backend_complete_agent_verification: {
        Args: {
          p_agent_id: string
          p_api_key_hash: string
          p_api_key_prefix: string
          p_nonce: string
          p_signature: string
        }
        Returns: boolean
      }
      backend_complete_launch_lock: {
        Args: {
          p_idempotency_key: string
          p_mint_address: string
          p_success: boolean
          p_token_id: string
        }
        Returns: undefined
      }
      backend_complete_token_job: {
        Args: {
          p_dbc_pool_address: string
          p_fun_token_id: string
          p_job_id: string
          p_mint_address: string
        }
        Returns: undefined
      }
      backend_create_agent_verification: {
        Args: { p_agent_id: string }
        Returns: {
          challenge: string
          expires_at: string
          nonce: string
        }[]
      }
      backend_create_api_account: {
        Args: {
          p_api_key_hash: string
          p_api_key_prefix: string
          p_fee_wallet_address?: string
          p_wallet_address: string
        }
        Returns: string
      }
      backend_create_base_token: {
        Args: {
          p_creator_fee_bps?: number
          p_creator_wallet: string
          p_description?: string
          p_evm_factory_tx_hash: string
          p_evm_pool_address: string
          p_evm_token_address: string
          p_fair_launch_duration_mins?: number
          p_image_url?: string
          p_name: string
          p_starting_mcap_usd?: number
          p_ticker: string
          p_twitter_url?: string
          p_website_url?: string
        }
        Returns: string
      }
      backend_create_bnb_token: {
        Args: {
          p_creator_fee_bps?: number
          p_creator_wallet: string
          p_description?: string
          p_evm_factory_tx_hash: string
          p_evm_pool_address: string
          p_evm_token_address: string
          p_fair_launch_duration_mins?: number
          p_image_url?: string
          p_name: string
          p_starting_mcap_usd?: number
          p_ticker: string
          p_twitter_url?: string
          p_website_url?: string
        }
        Returns: string
      }
      backend_create_fee_earner: {
        Args: {
          p_earner_type: string
          p_profile_id?: string
          p_share_bps: number
          p_token_id: string
          p_twitter_handle?: string
          p_wallet_address?: string
        }
        Returns: string
      }
      backend_create_promotion: {
        Args: {
          p_fun_token_id: string
          p_payment_address: string
          p_payment_private_key: string
          p_promoter_wallet: string
        }
        Returns: string
      }
      backend_create_sniper_trade: {
        Args: {
          p_buy_amount_sol?: number
          p_fun_token_id?: string
          p_mint_address?: string
          p_pool_address?: string
          p_token_id?: string
        }
        Returns: string
      }
      backend_create_system_post: {
        Args: { p_content: string; p_image_url?: string; p_user_id: string }
        Returns: string
      }
      backend_create_token: {
        Args: {
          p_creator_fee_bps?: number
          p_creator_id?: string
          p_creator_wallet: string
          p_dbc_pool_address?: string
          p_description?: string
          p_discord_url?: string
          p_graduation_threshold_sol?: number
          p_id: string
          p_image_url?: string
          p_market_cap_sol?: number
          p_mint_address: string
          p_name: string
          p_price_sol?: number
          p_real_sol_reserves?: number
          p_real_token_reserves?: number
          p_system_fee_bps?: number
          p_telegram_url?: string
          p_ticker: string
          p_total_supply?: number
          p_twitter_url?: string
          p_virtual_sol_reserves?: number
          p_virtual_token_reserves?: number
          p_website_url?: string
        }
        Returns: string
      }
      backend_create_token_job: {
        Args: {
          p_client_ip?: string
          p_creator_wallet: string
          p_description?: string
          p_image_url?: string
          p_name: string
          p_ticker: string
          p_twitter_url?: string
          p_website_url?: string
        }
        Returns: string
      }
      backend_create_trading_agent: {
        Args: {
          p_avatar_url: string
          p_creator_wallet?: string
          p_description: string
          p_name: string
          p_strategy_type?: string
          p_ticker: string
          p_wallet_address: string
          p_wallet_private_key_encrypted: string
        }
        Returns: string
      }
      backend_fail_sniper_trade: {
        Args: { p_error_message: string; p_id: string }
        Returns: undefined
      }
      backend_fail_token_job: {
        Args: { p_error_message: string; p_job_id: string }
        Returns: undefined
      }
      backend_get_and_reserve_specific_vanity_keypair: {
        Args: { p_keypair_id: string }
        Returns: {
          id: string
          public_key: string
          secret_key_encrypted: string
          status: string
          suffix: string
        }[]
      }
      backend_get_recent_vanity_keypairs: {
        Args: { p_limit?: number; p_suffix?: string }
        Returns: {
          created_at: string
          id: string
          public_key: string
          status: string
          suffix: string
          used_for_token_id: string
        }[]
      }
      backend_get_specific_vanity_keypair: {
        Args: { p_keypair_id: string }
        Returns: {
          id: string
          public_key: string
          secret_key_encrypted: string
          status: string
          suffix: string
        }[]
      }
      backend_get_used_vanity_keypairs: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          id: string
          mint_address: string
          public_key: string
          suffix: string
          token_id: string
          token_name: string
          token_ticker: string
        }[]
      }
      backend_get_vanity_stats: {
        Args: { p_suffix?: string }
        Returns: {
          available: number
          reserved: number
          total: number
          used: number
        }[]
      }
      backend_get_vanity_suffixes: {
        Args: never
        Returns: {
          count: number
          suffix: string
        }[]
      }
      backend_insert_treasury_claim: {
        Args: {
          p_claimed_sol?: number
          p_is_registered?: boolean
          p_mint_address?: string
          p_pool_address: string
          p_signature?: string
          p_token_name?: string
        }
        Returns: string
      }
      backend_insert_vanity_keypair: {
        Args: {
          p_public_key: string
          p_secret_key_encrypted: string
          p_suffix: string
        }
        Returns: string
      }
      backend_link_trading_agent_token: {
        Args: { p_fun_token_id: string; p_trading_agent_id: string }
        Returns: undefined
      }
      backend_manage_webhook: {
        Args: {
          p_action: string
          p_api_account_id: string
          p_events?: string[]
          p_is_active?: boolean
          p_secret?: string
          p_url?: string
          p_webhook_id?: string
        }
        Returns: Json
      }
      backend_mark_vanity_used: {
        Args: { p_keypair_id: string; p_token_id: string }
        Returns: undefined
      }
      backend_open_trading_position: {
        Args: {
          p_amount_tokens: number
          p_entry_narrative?: string
          p_entry_price_sol: number
          p_entry_reason: string
          p_investment_sol: number
          p_token_address: string
          p_token_image_url: string
          p_token_name: string
          p_token_symbol: string
          p_trading_agent_id: string
        }
        Returns: string
      }
      backend_record_base_buyback: {
        Args: {
          p_eth_amount: number
          p_fun_token_id: string
          p_tokens_bought: number
          p_tx_hash: string
        }
        Returns: string
      }
      backend_record_base_claim: {
        Args: {
          p_claimed_eth: number
          p_creator_wallet: string
          p_fun_token_id: string
          p_tx_hash: string
        }
        Returns: string
      }
      backend_record_trading_agent_deposit: {
        Args: {
          p_amount_sol: number
          p_signature?: string
          p_source?: string
          p_trading_agent_id: string
        }
        Returns: string
      }
      backend_record_trading_agent_trade: {
        Args: {
          p_amount_sol: number
          p_amount_tokens: number
          p_error_message?: string
          p_execution_time_ms?: number
          p_narrative_match?: string
          p_position_id: string
          p_price_per_token: number
          p_signature?: string
          p_slippage_actual?: number
          p_status?: string
          p_strategy_used?: string
          p_token_address: string
          p_token_name: string
          p_token_score?: number
          p_trade_type: string
          p_trading_agent_id: string
        }
        Returns: string
      }
      backend_record_transaction: {
        Args: {
          p_creator_fee_sol?: number
          p_price_per_token: number
          p_signature: string
          p_slot?: number
          p_sol_amount: number
          p_system_fee_sol?: number
          p_token_amount: number
          p_token_id: string
          p_transaction_type: string
          p_user_profile_id?: string
          p_user_wallet: string
        }
        Returns: string
      }
      backend_release_vanity_address: {
        Args: { p_keypair_id: string }
        Returns: undefined
      }
      backend_reserve_vanity_address: {
        Args: { p_suffix: string }
        Returns: {
          id: string
          public_key: string
          secret_key_encrypted: string
        }[]
      }
      backend_update_fee_earner: {
        Args: {
          p_earner_type: string
          p_fee_amount: number
          p_token_id: string
        }
        Returns: undefined
      }
      backend_update_holder_count: {
        Args: { p_token_id: string }
        Returns: undefined
      }
      backend_update_promotion_status: {
        Args: {
          p_promotion_id: string
          p_signature?: string
          p_status: string
          p_twitter_post_id?: string
        }
        Returns: boolean
      }
      backend_update_sniper_buy: {
        Args: {
          p_buy_signature: string
          p_buy_slot?: number
          p_id: string
          p_tokens_received?: number
        }
        Returns: undefined
      }
      backend_update_sniper_sell: {
        Args: {
          p_id: string
          p_sell_signature: string
          p_sell_slot?: number
          p_sol_received?: number
        }
        Returns: undefined
      }
      backend_update_token_state: {
        Args: {
          p_bonding_curve_progress: number
          p_market_cap_sol: number
          p_price_sol: number
          p_real_sol_reserves: number
          p_real_token_reserves: number
          p_token_id: string
          p_virtual_sol_reserves: number
          p_virtual_token_reserves: number
          p_volume_delta?: number
        }
        Returns: undefined
      }
      backend_upsert_pool_cache: {
        Args: {
          p_claimable_sol?: number
          p_is_registered?: boolean
          p_mint_address?: string
          p_pool_address: string
          p_registered_in?: string
          p_token_name?: string
        }
        Returns: undefined
      }
      backend_upsert_pumpfun_trending: {
        Args: {
          p_created_timestamp: number
          p_holder_count: number
          p_image_url: string
          p_is_king_of_hill: boolean
          p_market_cap_sol: number
          p_mint_address: string
          p_name: string
          p_narrative_match?: string
          p_symbol: string
          p_token_score: number
          p_virtual_sol_reserves: number
        }
        Returns: undefined
      }
      backend_upsert_token_holding: {
        Args: {
          p_balance_delta: number
          p_profile_id?: string
          p_token_id: string
          p_wallet_address: string
        }
        Returns: undefined
      }
      calculate_creator_share: {
        Args: {
          p_claimed_sol: number
          p_creator_fee_bps: number
          p_trading_fee_bps: number
        }
        Returns: {
          creator_sol: number
          platform_sol: number
        }[]
      }
      calculate_trending_topics: { Args: never; Returns: undefined }
      can_pin_posts: { Args: { _user_id: string }; Returns: boolean }
      cleanup_old_bot_replies: { Args: never; Returns: undefined }
      cleanup_old_debug_logs: { Args: never; Returns: undefined }
      cleanup_old_launch_locks: { Args: never; Returns: undefined }
      cleanup_old_promo_queue: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      cleanup_old_visitor_sessions: { Args: never; Returns: undefined }
      generate_post_slug: { Args: { title: string }; Returns: string }
      generate_short_id: { Args: never; Returns: string }
      get_active_promotion: {
        Args: { p_fun_token_id: string }
        Returns: {
          expires_at: string
          id: string
          posted_at: string
          status: string
          twitter_post_id: string
        }[]
      }
      get_active_visitors_count: { Args: never; Returns: number }
      get_agent_by_wallet: {
        Args: { p_wallet_address: string }
        Returns: {
          has_api_key: boolean
          id: string
          name: string
          total_fees_earned_sol: number
          total_tokens_launched: number
          verified_at: string
          wallet_address: string
        }[]
      }
      get_agent_token_stats: { Args: never; Returns: Json }
      get_api_account_by_wallet: {
        Args: { p_wallet_address: string }
        Returns: {
          api_key_prefix: string
          created_at: string
          fee_wallet_address: string
          id: string
          status: string
          total_fees_earned: number
          total_fees_paid_out: number
          wallet_address: string
        }[]
      }
      get_api_leaderboard: {
        Args: { p_limit?: number }
        Returns: {
          launchpads_count: number
          member_since: string
          rank: number
          tokens_launched: number
          total_fees_earned: number
          total_fees_paid_out: number
          wallet_address: string
        }[]
      }
      get_fun_fee_claims_summary: {
        Args: never
        Returns: {
          claim_count: number
          total_claimed_sol: number
        }[]
      }
      get_or_create_referral_code: {
        Args: { p_profile_id: string }
        Returns: string
      }
      get_platform_stats: {
        Args: never
        Returns: {
          token_count: number
          total_agent_payouts: number
          total_fee_claims: number
          total_fees_earned: number
          total_mcap_sol: number
        }[]
      }
      get_referral_stats: {
        Args: { p_referrer_id: string }
        Returns: {
          rewards_this_month: number
          total_referrals: number
          total_rewards_sol: number
        }[]
      }
      get_referrer_for_user: { Args: { p_user_id: string }; Returns: string }
      get_suggested_users: {
        Args: { current_user_id: string; limit_count?: number }
        Returns: {
          avatar_url: string
          bio: string
          display_name: string
          followers_count: number
          id: string
          suggestion_score: number
          username: string
          verified_type: string
        }[]
      }
      get_trading_agents_leaderboard: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          avatar_url: string
          created_at: string
          fun_token_id: string
          id: string
          name: string
          status: string
          strategy_type: string
          ticker: string
          total_profit_sol: number
          total_trades: number
          trading_capital_sol: number
          unrealized_pnl_sol: number
          win_rate: number
        }[]
      }
      get_treasury_claims_summary: {
        Args: never
        Returns: {
          claim_count: number
          total_claimed_sol: number
        }[]
      }
      get_treasury_pool_cache: {
        Args: never
        Returns: {
          claimable_sol: number
          discovered_at: string
          is_registered: boolean
          last_checked_at: string
          mint_address: string
          pool_address: string
          registered_in: string
          token_name: string
        }[]
      }
      get_user_ips: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_punch_count: { Args: { p_count?: number }; Returns: undefined }
      increment_punch_user_launches: {
        Args: { p_wallet_address: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_ip_banned: { Args: { _ip_address: string }; Returns: boolean }
      is_user_banned: { Args: { _user_id: string }; Returns: boolean }
      release_claim_lock: { Args: { p_token_id: string }; Returns: undefined }
      release_claw_creator_claim_lock: {
        Args: { p_twitter_username: string }
        Returns: undefined
      }
      release_creator_claim_lock: {
        Args: { p_twitter_username: string }
        Returns: undefined
      }
      snapshot_fun_token_prices: { Args: never; Returns: undefined }
      submit_tuna_migration: {
        Args: {
          p_amount_sent: number
          p_tx_signature?: string
          p_wallet_address: string
        }
        Returns: boolean
      }
      update_token_24h_stats: { Args: never; Returns: undefined }
      upsert_bot_user_topic: {
        Args: {
          p_account_id: string
          p_topic: string
          p_tweet_author_id: string
          p_tweet_author_username: string
        }
        Returns: undefined
      }
      upsert_punch_user: {
        Args: {
          p_fingerprint?: string
          p_ip_address?: string
          p_wallet_address: string
        }
        Returns: string
      }
      verify_api_key: {
        Args: { p_api_key: string }
        Returns: {
          account_id: string
          fee_wallet_address: string
          is_valid: boolean
          status: string
          wallet_address: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
