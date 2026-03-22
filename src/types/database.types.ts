export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          role: 'admin' | 'tech' | 'editor'
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string
          email?: string
          role?: 'admin' | 'tech' | 'editor'
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          full_name?: string
          role?: 'admin' | 'tech' | 'editor'
          avatar_url?: string | null
          updated_at?: string
        }
      }
      wa_accounts: {
        Row: {
          id: string
          phone_number: string
          country: string
          status: 'warming' | 'active' | 'banned'
          start_date: string
          bm_id: string | null
          bm_link_url: string | null
          manychat_name: string | null
          manychat_url: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          phone_number: string
          country: string
          status?: 'warming' | 'active' | 'banned'
          start_date: string
          bm_id?: string | null
          bm_link_url?: string | null
          manychat_name?: string | null
          manychat_url?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          phone_number?: string
          country?: string
          status?: 'warming' | 'active' | 'banned'
          start_date?: string
          bm_id?: string | null
          bm_link_url?: string | null
          manychat_name?: string | null
          manychat_url?: string | null
          notes?: string | null
          updated_at?: string
        }
      }
      offers: {
        Row: {
          id: string
          name: string
          country: string
          channel: 'whatsapp' | 'shopify' | 'both'
          status: 'active' | 'paused' | 'archived'
          target_roas: number | null
          target_cpl: number | null
          target_cpa: number | null
          current_roas: number | null
          current_cpl: number | null
          start_date: string
          end_date: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          country: string
          channel: 'whatsapp' | 'shopify' | 'both'
          status?: 'active' | 'paused' | 'archived'
          target_roas?: number | null
          target_cpl?: number | null
          target_cpa?: number | null
          current_roas?: number | null
          current_cpl?: number | null
          start_date: string
          end_date?: string | null
          notes?: string | null
          created_by?: string | null
        }
        Update: {
          name?: string
          country?: string
          channel?: 'whatsapp' | 'shopify' | 'both'
          status?: 'active' | 'paused' | 'archived'
          target_roas?: number | null
          target_cpl?: number | null
          target_cpa?: number | null
          current_roas?: number | null
          current_cpl?: number | null
          start_date?: string
          end_date?: string | null
          notes?: string | null
          updated_at?: string
        }
      }
      expenses: {
        Row: {
          id: string
          amount: number
          currency: 'USD' | 'ARS'
          category: 'ad_spend' | 'platform_fees' | 'tools_software' | 'team_salaries' | 'creative_production' | 'other'
          description: string | null
          expense_date: string
          offer_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          amount: number
          currency?: 'USD' | 'ARS'
          category: 'ad_spend' | 'platform_fees' | 'tools_software' | 'team_salaries' | 'creative_production' | 'other'
          description?: string | null
          expense_date: string
          offer_id?: string | null
          created_by?: string | null
        }
        Update: {
          amount?: number
          currency?: 'USD' | 'ARS'
          category?: 'ad_spend' | 'platform_fees' | 'tools_software' | 'team_salaries' | 'creative_production' | 'other'
          description?: string | null
          expense_date?: string
          offer_id?: string | null
          updated_at?: string
        }
      }
      revenue_entries: {
        Row: {
          id: string
          amount: number
          currency: 'USD' | 'ARS'
          channel: 'whatsapp' | 'shopify' | 'other'
          revenue_date: string
          offer_id: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          amount: number
          currency?: 'USD' | 'ARS'
          channel: 'whatsapp' | 'shopify' | 'other'
          revenue_date: string
          offer_id?: string | null
          notes?: string | null
          created_by?: string | null
        }
        Update: {
          amount?: number
          currency?: 'USD' | 'ARS'
          channel?: 'whatsapp' | 'shopify' | 'other'
          revenue_date?: string
          offer_id?: string | null
          notes?: string | null
          updated_at?: string
        }
      }
      creatives: {
        Row: {
          id: string
          name: string
          offer_id: string | null
          asset_url: string | null
          asset_type: 'image' | 'video' | 'copy' | 'other' | null
          status: 'active' | 'retired'
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          offer_id?: string | null
          asset_url?: string | null
          asset_type?: 'image' | 'video' | 'copy' | 'other' | null
          status?: 'active' | 'retired'
          created_by?: string | null
        }
        Update: {
          name?: string
          offer_id?: string | null
          asset_url?: string | null
          asset_type?: 'image' | 'video' | 'copy' | 'other' | null
          status?: 'active' | 'retired'
          updated_at?: string
        }
      }
      team_checklists: {
        Row: {
          id: string
          title: string
          assigned_role: 'admin' | 'tech' | 'editor' | 'all' | null
          is_recurring: boolean
          recurrence: 'daily' | 'weekly' | 'monthly' | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          assigned_role?: 'admin' | 'tech' | 'editor' | 'all' | null
          is_recurring?: boolean
          recurrence?: 'daily' | 'weekly' | 'monthly' | null
          created_by?: string | null
        }
        Update: {
          title?: string
          assigned_role?: 'admin' | 'tech' | 'editor' | 'all' | null
          is_recurring?: boolean
          recurrence?: 'daily' | 'weekly' | 'monthly' | null
          updated_at?: string
        }
      }
      checklist_items: {
        Row: {
          id: string
          checklist_id: string
          label: string
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          checklist_id: string
          label: string
          position?: number
        }
        Update: {
          label?: string
          position?: number
          updated_at?: string
        }
      }
      checklist_completions: {
        Row: {
          id: string
          item_id: string
          completed_by: string
          completed_at: string
        }
        Insert: {
          id?: string
          item_id: string
          completed_by: string
          completed_at?: string
        }
        Update: never
      }
      drive_links: {
        Row: {
          id: string
          title: string
          url: string
          category: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          url: string
          category?: string | null
          created_by?: string | null
        }
        Update: {
          title?: string
          url?: string
          category?: string | null
          updated_at?: string
        }
      }
      activity_log: {
        Row: {
          id: string
          user_id: string
          action: string
          entity_type: string
          entity_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action: string
          entity_type: string
          entity_id?: string | null
          metadata?: Json | null
        }
        Update: never
      }
      settings: {
        Row: {
          id: string
          value: Json
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id: string
          value: Json
          updated_by?: string | null
        }
        Update: {
          value?: Json
          updated_by?: string | null
          updated_at?: string
        }
      }
    }
    Views: {
      daily_pnl: {
        Row: {
          date: string | null
          total_revenue: number | null
          total_expenses: number | null
          profit: number | null
          ad_spend: number | null
        }
      }
    }
    Functions: {
      wa_ready_date: {
        Args: { start_date: string }
        Returns: string
      }
    }
  }
}
