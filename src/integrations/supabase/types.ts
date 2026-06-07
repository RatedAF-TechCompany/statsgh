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
      alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          message: string
          resolved_at: string | null
          source_name: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          message: string
          resolved_at?: string | null
          source_name?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          message?: string
          resolved_at?: string | null
          source_name?: string | null
        }
        Relationships: []
      }
      article_indicators: {
        Row: {
          article_id: string
          cited_date: string | null
          cited_geography_id: string | null
          cited_value: number | null
          context_note: string | null
          created_at: string | null
          display_order: number | null
          id: string
          indicator_id: string
        }
        Insert: {
          article_id: string
          cited_date?: string | null
          cited_geography_id?: string | null
          cited_value?: number | null
          context_note?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          indicator_id: string
        }
        Update: {
          article_id?: string
          cited_date?: string | null
          cited_geography_id?: string | null
          cited_value?: number | null
          context_note?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          indicator_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_indicators_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_indicators_cited_geography_id_fkey"
            columns: ["cited_geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_indicators_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      article_sources: {
        Row: {
          article_id: string
          citation_text: string | null
          created_at: string | null
          display_order: number | null
          id: string
          source_id: string
        }
        Insert: {
          article_id: string
          citation_text?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          source_id: string
        }
        Update: {
          article_id?: string
          citation_text?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_sources_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      article_versions: {
        Row: {
          article_id: string | null
          body: string
          created_at: string | null
          id: string
          is_autosave: boolean | null
          saved_by: string | null
          title: string
          version_number: number
        }
        Insert: {
          article_id?: string | null
          body: string
          created_at?: string | null
          id?: string
          is_autosave?: boolean | null
          saved_by?: string | null
          title: string
          version_number: number
        }
        Update: {
          article_id?: string | null
          body?: string
          created_at?: string | null
          id?: string
          is_autosave?: boolean | null
          saved_by?: string | null
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "article_versions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_versions_saved_by_fkey"
            columns: ["saved_by"]
            isOneToOne: false
            referencedRelation: "author_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_versions_saved_by_fkey"
            columns: ["saved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      article_views: {
        Row: {
          article_id: string | null
          device_type: string | null
          id: string
          referrer: string | null
          user_agent: string | null
          viewed_at: string | null
        }
        Insert: {
          article_id?: string | null
          device_type?: string | null
          id?: string
          referrer?: string | null
          user_agent?: string | null
          viewed_at?: string | null
        }
        Update: {
          article_id?: string | null
          device_type?: string | null
          id?: string
          referrer?: string | null
          user_agent?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "article_views_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          audio_url: string | null
          author_id: string | null
          author_name: string
          body: string
          category_id: string | null
          category_slug: string
          created_at: string
          dedupe_key: string | null
          hero_image_url: string | null
          id: string
          instagram_comment: string | null
          instagram_compressed: string | null
          is_breaking: boolean
          is_most_read: boolean
          is_published: boolean
          is_wire: boolean
          meta_title: string | null
          published_at: string | null
          scheduled_at: string | null
          section: string
          seo_description: string | null
          slug: string
          source_published_at: string | null
          status: string | null
          subtitle: string | null
          summary: string
          tags: string[] | null
          title: string
          twitter_post: string | null
          updated_at: string
          video_url: string | null
          word_count: number | null
        }
        Insert: {
          audio_url?: string | null
          author_id?: string | null
          author_name: string
          body: string
          category_id?: string | null
          category_slug: string
          created_at?: string
          dedupe_key?: string | null
          hero_image_url?: string | null
          id?: string
          instagram_comment?: string | null
          instagram_compressed?: string | null
          is_breaking?: boolean
          is_most_read?: boolean
          is_published?: boolean
          is_wire?: boolean
          meta_title?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          section: string
          seo_description?: string | null
          slug: string
          source_published_at?: string | null
          status?: string | null
          subtitle?: string | null
          summary: string
          tags?: string[] | null
          title: string
          twitter_post?: string | null
          updated_at?: string
          video_url?: string | null
          word_count?: number | null
        }
        Update: {
          audio_url?: string | null
          author_id?: string | null
          author_name?: string
          body?: string
          category_id?: string | null
          category_slug?: string
          created_at?: string
          dedupe_key?: string | null
          hero_image_url?: string | null
          id?: string
          instagram_comment?: string | null
          instagram_compressed?: string | null
          is_breaking?: boolean
          is_most_read?: boolean
          is_published?: boolean
          is_wire?: boolean
          meta_title?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          section?: string
          seo_description?: string | null
          slug?: string
          source_published_at?: string | null
          status?: string | null
          subtitle?: string | null
          summary?: string
          tags?: string[] | null
          title?: string
          twitter_post?: string | null
          updated_at?: string
          video_url?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action_type: string
          created_at: string | null
          description: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
          timestamp: string | null
          user_email: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          description: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          timestamp?: string | null
          user_email: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          description?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          timestamp?: string | null
          user_email?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "author_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bog_scan_items: {
        Row: {
          bog_url: string
          created_at: string
          dedupe_hash: string
          detected_topics: string[] | null
          id: string
          published_date: string | null
          qualifies: boolean
          reason: string | null
          run_id: string
          title: string
        }
        Insert: {
          bog_url: string
          created_at?: string
          dedupe_hash: string
          detected_topics?: string[] | null
          id?: string
          published_date?: string | null
          qualifies?: boolean
          reason?: string | null
          run_id: string
          title: string
        }
        Update: {
          bog_url?: string
          created_at?: string
          dedupe_hash?: string
          detected_topics?: string[] | null
          id?: string
          published_date?: string | null
          qualifies?: boolean
          reason?: string | null
          run_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "bog_scan_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "bog_scan_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      bog_scan_runs: {
        Row: {
          created_at: string
          id: string
          indicators_refreshed: number | null
          items_qualifying: number | null
          items_scanned: number | null
          notes: string | null
          run_time_utc: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          indicators_refreshed?: number | null
          items_qualifying?: number | null
          items_scanned?: number | null
          notes?: string | null
          run_time_utc?: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          indicators_refreshed?: number | null
          items_qualifying?: number | null
          items_scanned?: number | null
          notes?: string | null
          run_time_utc?: string
          status?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          article_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "author_profiles"
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
      categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          article_id: string
          body: string
          created_at: string
          email: string
          id: string
          is_published: boolean
          name: string | null
          parent_id: string | null
          verification_code: string
          verification_expires_at: string
        }
        Insert: {
          article_id: string
          body: string
          created_at?: string
          email: string
          id?: string
          is_published?: boolean
          name?: string | null
          parent_id?: string | null
          verification_code: string
          verification_expires_at: string
        }
        Update: {
          article_id?: string
          body?: string
          created_at?: string
          email?: string
          id?: string
          is_published?: boolean
          name?: string | null
          parent_id?: string | null
          verification_code?: string
          verification_expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments_public"
            referencedColumns: ["id"]
          },
        ]
      }
      commodity_prices: {
        Row: {
          change_percent: number | null
          commodity: string
          created_at: string | null
          currency: string | null
          fetched_at: string | null
          id: string
          previous_close: number | null
          price: number
          source: string | null
          unit: string | null
        }
        Insert: {
          change_percent?: number | null
          commodity: string
          created_at?: string | null
          currency?: string | null
          fetched_at?: string | null
          id?: string
          previous_close?: number | null
          price: number
          source?: string | null
          unit?: string | null
        }
        Update: {
          change_percent?: number | null
          commodity?: string
          created_at?: string | null
          currency?: string | null
          fetched_at?: string | null
          id?: string
          previous_close?: number | null
          price?: number
          source?: string | null
          unit?: string | null
        }
        Relationships: []
      }
      currency_rates: {
        Row: {
          base_currency: string | null
          change_percent: number | null
          created_at: string | null
          fetched_at: string | null
          id: string
          previous_rate: number | null
          rate: number
          source: string | null
          target_currency: string | null
        }
        Insert: {
          base_currency?: string | null
          change_percent?: number | null
          created_at?: string | null
          fetched_at?: string | null
          id?: string
          previous_rate?: number | null
          rate: number
          source?: string | null
          target_currency?: string | null
        }
        Update: {
          base_currency?: string | null
          change_percent?: number | null
          created_at?: string | null
          fetched_at?: string | null
          id?: string
          previous_rate?: number | null
          rate?: number
          source?: string | null
          target_currency?: string | null
        }
        Relationships: []
      }
      dashboard_updates: {
        Row: {
          id: string
          indicator_key: string
          period: string | null
          run_id: string | null
          source: string
          source_detail: string | null
          unit: string | null
          updated_at_utc: string
          value: number | null
        }
        Insert: {
          id?: string
          indicator_key: string
          period?: string | null
          run_id?: string | null
          source?: string
          source_detail?: string | null
          unit?: string | null
          updated_at_utc?: string
          value?: number | null
        }
        Update: {
          id?: string
          indicator_key?: string
          period?: string | null
          run_id?: string | null
          source?: string
          source_detail?: string | null
          unit?: string | null
          updated_at_utc?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_updates_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "bog_scan_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      data_imports: {
        Row: {
          completed_at: string | null
          created_at: string | null
          dataset_id: string | null
          error_log: Json | null
          filename: string
          id: string
          imported_by: string | null
          indicator_id: string | null
          rows_failed: number | null
          rows_imported: number | null
          rows_total: number | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          dataset_id?: string | null
          error_log?: Json | null
          filename: string
          id?: string
          imported_by?: string | null
          indicator_id?: string | null
          rows_failed?: number | null
          rows_imported?: number | null
          rows_total?: number | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          dataset_id?: string | null
          error_log?: Json | null
          filename?: string
          id?: string
          imported_by?: string | null
          indicator_id?: string | null
          rows_failed?: number | null
          rows_imported?: number | null
          rows_total?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_imports_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_imports_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      data_points: {
        Row: {
          created_at: string | null
          date: string
          id: string
          is_estimate: boolean | null
          is_provisional: boolean | null
          revision_note: string | null
          series_id: string
          source_id: string | null
          source_note: string | null
          updated_at: string | null
          value: number
          value_formatted: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          is_estimate?: boolean | null
          is_provisional?: boolean | null
          revision_note?: string | null
          series_id: string
          source_id?: string | null
          source_note?: string | null
          updated_at?: string | null
          value: number
          value_formatted?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          is_estimate?: boolean | null
          is_provisional?: boolean | null
          revision_note?: string | null
          series_id?: string
          source_id?: string | null
          source_note?: string | null
          updated_at?: string | null
          value?: number
          value_formatted?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_points_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "data_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_points_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      data_series: {
        Row: {
          breakdown_type: string | null
          breakdown_value: string | null
          created_at: string | null
          dataset_id: string | null
          external_key: string | null
          geography_id: string
          id: string
          indicator_id: string
          is_primary: boolean | null
          name: string | null
          source_id: string | null
          updated_at: string | null
        }
        Insert: {
          breakdown_type?: string | null
          breakdown_value?: string | null
          created_at?: string | null
          dataset_id?: string | null
          external_key?: string | null
          geography_id: string
          id?: string
          indicator_id: string
          is_primary?: boolean | null
          name?: string | null
          source_id?: string | null
          updated_at?: string | null
        }
        Update: {
          breakdown_type?: string | null
          breakdown_value?: string | null
          created_at?: string | null
          dataset_id?: string | null
          external_key?: string | null
          geography_id?: string
          id?: string
          indicator_id?: string
          is_primary?: boolean | null
          name?: string | null
          source_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_series_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_series_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_series_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      data_sources: {
        Row: {
          country_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_ghana_source: boolean | null
          logo_url: string | null
          name: string
          reliability_notes: string | null
          short_name: string | null
          source_type: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          country_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_ghana_source?: boolean | null
          logo_url?: string | null
          name: string
          reliability_notes?: string | null
          short_name?: string | null
          source_type?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          country_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_ghana_source?: boolean | null
          logo_url?: string | null
          name?: string
          reliability_notes?: string | null
          short_name?: string | null
          source_type?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_sources_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
        ]
      }
      data_topics: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_topics_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "data_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      datasets: {
        Row: {
          coverage_end: string | null
          coverage_start: string | null
          created_at: string | null
          description: string | null
          id: string
          is_ghana_dataset: boolean | null
          last_updated_at: string | null
          license: string | null
          name: string
          slug: string
          source_document: string | null
          source_id: string
          source_url: string | null
          update_frequency: string | null
          updated_at: string | null
        }
        Insert: {
          coverage_end?: string | null
          coverage_start?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_ghana_dataset?: boolean | null
          last_updated_at?: string | null
          license?: string | null
          name: string
          slug: string
          source_document?: string | null
          source_id: string
          source_url?: string | null
          update_frequency?: string | null
          updated_at?: string | null
        }
        Update: {
          coverage_end?: string | null
          coverage_start?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_ghana_dataset?: boolean | null
          last_updated_at?: string | null
          license?: string | null
          name?: string
          slug?: string
          source_document?: string | null
          source_id?: string
          source_url?: string | null
          update_frequency?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "datasets_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_calendar: {
        Row: {
          actual_value: string | null
          created_at: string | null
          description: string | null
          event_type: string
          id: string
          impact_level: string | null
          indicator_slug: string | null
          is_recurring: boolean | null
          previous_value: string | null
          recurrence_rule: string | null
          scheduled_date: string
          source_name: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          actual_value?: string | null
          created_at?: string | null
          description?: string | null
          event_type?: string
          id?: string
          impact_level?: string | null
          indicator_slug?: string | null
          is_recurring?: boolean | null
          previous_value?: string | null
          recurrence_rule?: string | null
          scheduled_date: string
          source_name?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          actual_value?: string | null
          created_at?: string | null
          description?: string | null
          event_type?: string
          id?: string
          impact_level?: string | null
          indicator_slug?: string | null
          is_recurring?: boolean | null
          previous_value?: string | null
          recurrence_rule?: string | null
          scheduled_date?: string
          source_name?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      geographies: {
        Row: {
          code: string | null
          created_at: string | null
          display_order: number | null
          id: string
          is_ghana: boolean | null
          iso_alpha2: string | null
          iso_alpha3: string | null
          name: string
          parent_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_ghana?: boolean | null
          iso_alpha2?: string | null
          iso_alpha3?: string | null
          name: string
          parent_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_ghana?: boolean | null
          iso_alpha2?: string | null
          iso_alpha3?: string | null
          name?: string
          parent_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "geographies_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
        ]
      }
      geography_set_members: {
        Row: {
          geography_id: string
          geography_set_id: string
          id: string
          sort_order: number | null
        }
        Insert: {
          geography_id: string
          geography_set_id: string
          id?: string
          sort_order?: number | null
        }
        Update: {
          geography_id?: string
          geography_set_id?: string
          id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "geography_set_members_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geography_set_members_geography_set_id_fkey"
            columns: ["geography_set_id"]
            isOneToOne: false
            referencedRelation: "geography_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      geography_sets: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          type?: string | null
        }
        Relationships: []
      }
      ghana_series_tags: {
        Row: {
          created_at: string | null
          id: string
          series_id: string
          tag: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          series_id: string
          tag: string
        }
        Update: {
          created_at?: string | null
          id?: string
          series_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghana_series_tags_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "data_series"
            referencedColumns: ["id"]
          },
        ]
      }
      gse_stocks: {
        Row: {
          change_percent: number | null
          created_at: string | null
          current_price: number
          id: string
          last_updated: string | null
          market_cap: number | null
          month_change_percent: number | null
          name: string
          previous_close: number | null
          price_one_month_ago: number | null
          sector: string | null
          symbol: string
          updated_at: string | null
          volume: number | null
        }
        Insert: {
          change_percent?: number | null
          created_at?: string | null
          current_price?: number
          id?: string
          last_updated?: string | null
          market_cap?: number | null
          month_change_percent?: number | null
          name: string
          previous_close?: number | null
          price_one_month_ago?: number | null
          sector?: string | null
          symbol: string
          updated_at?: string | null
          volume?: number | null
        }
        Update: {
          change_percent?: number | null
          created_at?: string | null
          current_price?: number
          id?: string
          last_updated?: string | null
          market_cap?: number | null
          month_change_percent?: number | null
          name?: string
          previous_close?: number | null
          price_one_month_ago?: number | null
          sector?: string | null
          symbol?: string
          updated_at?: string | null
          volume?: number | null
        }
        Relationships: []
      }
      indicator_topics: {
        Row: {
          id: string
          indicator_id: string
          is_primary: boolean | null
          topic_id: string
        }
        Insert: {
          id?: string
          indicator_id: string
          is_primary?: boolean | null
          topic_id: string
        }
        Update: {
          id?: string
          indicator_id?: string
          is_primary?: boolean | null
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicator_topics_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "data_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      indicators: {
        Row: {
          caveats: string | null
          chart_type: string | null
          created_at: string | null
          decimal_places: number | null
          default_geography_id: string | null
          definition: string | null
          description: string | null
          frequency: string | null
          id: string
          is_ghana_core: boolean | null
          methodology: string | null
          name: string
          priority_tier: string | null
          short_name: string | null
          show_change: boolean | null
          slug: string
          topic_id: string | null
          unit: string
          unit_display: string | null
          updated_at: string | null
        }
        Insert: {
          caveats?: string | null
          chart_type?: string | null
          created_at?: string | null
          decimal_places?: number | null
          default_geography_id?: string | null
          definition?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          is_ghana_core?: boolean | null
          methodology?: string | null
          name: string
          priority_tier?: string | null
          short_name?: string | null
          show_change?: boolean | null
          slug: string
          topic_id?: string | null
          unit: string
          unit_display?: string | null
          updated_at?: string | null
        }
        Update: {
          caveats?: string | null
          chart_type?: string | null
          created_at?: string | null
          decimal_places?: number | null
          default_geography_id?: string | null
          definition?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          is_ghana_core?: boolean | null
          methodology?: string | null
          name?: string
          priority_tier?: string | null
          short_name?: string | null
          show_change?: boolean | null
          slug?: string
          topic_id?: string | null
          unit?: string
          unit_display?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "indicators_default_geography_id_fkey"
            columns: ["default_geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicators_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "data_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_runs: {
        Row: {
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          indicator_slug: string
          rows_inserted: number | null
          rows_updated: number | null
          run_type: string
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          indicator_slug: string
          rows_inserted?: number | null
          rows_updated?: number | null
          run_type: string
          started_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          indicator_slug?: string
          rows_inserted?: number | null
          rows_updated?: number | null
          run_type?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      journalists: {
        Row: {
          bio: string | null
          byline_name: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          specialization: string
        }
        Insert: {
          bio?: string | null
          byline_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          specialization: string
        }
        Update: {
          bio?: string | null
          byline_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          specialization?: string
        }
        Relationships: []
      }
      media: {
        Row: {
          alt_text: string | null
          created_at: string | null
          filename: string
          id: string
          mime_type: string | null
          size: number | null
          tags: string[] | null
          uploaded_by: string | null
          url: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string | null
          filename: string
          id?: string
          mime_type?: string | null
          size?: number | null
          tags?: string[] | null
          uploaded_by?: string | null
          url: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string | null
          filename?: string
          id?: string
          mime_type?: string | null
          size?: number | null
          tags?: string[] | null
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "author_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_sends: {
        Row: {
          error_message: string | null
          id: string
          key_indicators: Json | null
          recipients_count: number | null
          sent_at: string | null
          status: string | null
          subject: string
          top_stories: Json | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          key_indicators?: Json | null
          recipients_count?: number | null
          sent_at?: string | null
          status?: string | null
          subject: string
          top_stories?: Json | null
        }
        Update: {
          error_message?: string | null
          id?: string
          key_indicators?: Json | null
          recipients_count?: number | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          top_stories?: Json | null
        }
        Relationships: []
      }
      newsroom_articles: {
        Row: {
          category_hint: string | null
          created_at: string
          dedupe_key: string | null
          error_message: string | null
          generated_article_id: string | null
          id: string
          image_style: string | null
          needs_review: boolean | null
          original_headline: string
          original_summary: string | null
          processing_status: string
          published_at: string | null
          review_reason: string | null
          run_id: string | null
          source_name: string
          source_published_at: string | null
          source_url: string | null
        }
        Insert: {
          category_hint?: string | null
          created_at?: string
          dedupe_key?: string | null
          error_message?: string | null
          generated_article_id?: string | null
          id?: string
          image_style?: string | null
          needs_review?: boolean | null
          original_headline: string
          original_summary?: string | null
          processing_status?: string
          published_at?: string | null
          review_reason?: string | null
          run_id?: string | null
          source_name: string
          source_published_at?: string | null
          source_url?: string | null
        }
        Update: {
          category_hint?: string | null
          created_at?: string
          dedupe_key?: string | null
          error_message?: string | null
          generated_article_id?: string | null
          id?: string
          image_style?: string | null
          needs_review?: boolean | null
          original_headline?: string
          original_summary?: string | null
          processing_status?: string
          published_at?: string | null
          review_reason?: string | null
          run_id?: string | null
          source_name?: string
          source_published_at?: string | null
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsroom_articles_generated_article_id_fkey"
            columns: ["generated_article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsroom_articles_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "newsroom_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      newsroom_candidates: {
        Row: {
          created_at: string | null
          decision: string
          dedupe_key: string | null
          dedupe_matched_article_id: string | null
          dedupe_matched_candidate_id: string | null
          dedupe_similarity_evidence: Json | null
          fetched_full_text: string | null
          headline: string
          id: string
          newsroom_article_id: string | null
          numbers_found: string[] | null
          pub_date_parsed: string | null
          pub_date_raw: string | null
          rejection_code: string | null
          rejection_detail: string | null
          rss_summary: string | null
          run_id: string | null
          source_name: string
          source_url: string | null
        }
        Insert: {
          created_at?: string | null
          decision?: string
          dedupe_key?: string | null
          dedupe_matched_article_id?: string | null
          dedupe_matched_candidate_id?: string | null
          dedupe_similarity_evidence?: Json | null
          fetched_full_text?: string | null
          headline: string
          id?: string
          newsroom_article_id?: string | null
          numbers_found?: string[] | null
          pub_date_parsed?: string | null
          pub_date_raw?: string | null
          rejection_code?: string | null
          rejection_detail?: string | null
          rss_summary?: string | null
          run_id?: string | null
          source_name: string
          source_url?: string | null
        }
        Update: {
          created_at?: string | null
          decision?: string
          dedupe_key?: string | null
          dedupe_matched_article_id?: string | null
          dedupe_matched_candidate_id?: string | null
          dedupe_similarity_evidence?: Json | null
          fetched_full_text?: string | null
          headline?: string
          id?: string
          newsroom_article_id?: string | null
          numbers_found?: string[] | null
          pub_date_parsed?: string | null
          pub_date_raw?: string | null
          rejection_code?: string | null
          rejection_detail?: string | null
          rss_summary?: string | null
          run_id?: string | null
          source_name?: string
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsroom_candidates_dedupe_matched_article_id_fkey"
            columns: ["dedupe_matched_article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsroom_candidates_dedupe_matched_candidate_id_fkey"
            columns: ["dedupe_matched_candidate_id"]
            isOneToOne: false
            referencedRelation: "newsroom_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsroom_candidates_newsroom_article_id_fkey"
            columns: ["newsroom_article_id"]
            isOneToOne: false
            referencedRelation: "newsroom_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsroom_candidates_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "newsroom_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      newsroom_runs: {
        Row: {
          articles_created: number | null
          articles_found: number | null
          completed_at: string | null
          created_by: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          started_at: string
          status: string
          trigger_type: string
        }
        Insert: {
          articles_created?: number | null
          articles_found?: number | null
          completed_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          started_at?: string
          status?: string
          trigger_type: string
        }
        Update: {
          articles_created?: number | null
          articles_found?: number | null
          completed_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          started_at?: string
          status?: string
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsroom_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "author_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsroom_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      newsroom_sources: {
        Row: {
          consecutive_errors: number | null
          created_at: string | null
          fallback_rss_url: string | null
          id: string
          is_active: boolean | null
          last_error_at: string | null
          last_error_message: string | null
          last_item_at: string | null
          last_success_at: string | null
          name: string
          priority_tier: number
          rss_url: string
          total_items_accepted: number | null
          total_items_seen: number | null
          trust_pub_date: boolean
          updated_at: string | null
        }
        Insert: {
          consecutive_errors?: number | null
          created_at?: string | null
          fallback_rss_url?: string | null
          id?: string
          is_active?: boolean | null
          last_error_at?: string | null
          last_error_message?: string | null
          last_item_at?: string | null
          last_success_at?: string | null
          name: string
          priority_tier?: number
          rss_url: string
          total_items_accepted?: number | null
          total_items_seen?: number | null
          trust_pub_date?: boolean
          updated_at?: string | null
        }
        Update: {
          consecutive_errors?: number | null
          created_at?: string | null
          fallback_rss_url?: string | null
          id?: string
          is_active?: boolean | null
          last_error_at?: string | null
          last_error_message?: string | null
          last_item_at?: string | null
          last_success_at?: string | null
          name?: string
          priority_tier?: number
          rss_url?: string
          total_items_accepted?: number | null
          total_items_seen?: number | null
          trust_pub_date?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          last_login_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          last_login_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          default_seo_description: string | null
          favicon_url: string | null
          footer_text: string | null
          id: string
          logo_url: string | null
          site_name: string | null
          social_image_url: string | null
          theme_colors: Json | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          default_seo_description?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          site_name?: string | null
          social_image_url?: string | null
          theme_colors?: Json | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          default_seo_description?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          site_name?: string | null
          social_image_url?: string | null
          theme_colors?: Json | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "author_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tweet_bank_items: {
        Row: {
          category: string
          created_at: string
          data_date: string | null
          hash: string
          id: string
          is_active: boolean
          text: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          data_date?: string | null
          hash: string
          id?: string
          is_active?: boolean
          text: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          data_date?: string | null
          hash?: string
          id?: string
          is_active?: boolean
          text?: string
          updated_at?: string
        }
        Relationships: []
      }
      tweet_scheduler_logs: {
        Row: {
          category: string | null
          cycle_id: string | null
          error_message: string | null
          id: string
          reason: string | null
          status: string
          timestamp: string
          tweet_id: string | null
          tweet_text: string | null
        }
        Insert: {
          category?: string | null
          cycle_id?: string | null
          error_message?: string | null
          id?: string
          reason?: string | null
          status: string
          timestamp?: string
          tweet_id?: string | null
          tweet_text?: string | null
        }
        Update: {
          category?: string | null
          cycle_id?: string | null
          error_message?: string | null
          id?: string
          reason?: string | null
          status?: string
          timestamp?: string
          tweet_id?: string | null
          tweet_text?: string | null
        }
        Relationships: []
      }
      tweet_scheduler_state: {
        Row: {
          cycle_id: string
          fail_count_24h: number
          id: number
          is_enabled: boolean
          last_error_at: string | null
          last_posted_at: string | null
          last_posted_hash: string | null
          posted_hashes: Json
          queue_hashes: Json
          quiet_end: string
          quiet_hours_enabled: boolean
          quiet_start: string
          timezone: string
          updated_at: string
        }
        Insert: {
          cycle_id?: string
          fail_count_24h?: number
          id?: number
          is_enabled?: boolean
          last_error_at?: string | null
          last_posted_at?: string | null
          last_posted_hash?: string | null
          posted_hashes?: Json
          queue_hashes?: Json
          quiet_end?: string
          quiet_hours_enabled?: boolean
          quiet_start?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          cycle_id?: string
          fail_count_24h?: number
          id?: number
          is_enabled?: boolean
          last_error_at?: string | null
          last_posted_at?: string | null
          last_posted_hash?: string | null
          posted_hashes?: Json
          queue_hashes?: Json
          quiet_end?: string
          quiet_hours_enabled?: boolean
          quiet_start?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          full_name: string
          id: string
          invite_token: string
          invited_by: string | null
          note: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string
          full_name: string
          id?: string
          invite_token: string
          invited_by?: string | null
          note?: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invite_token?: string
          invited_by?: string | null
          note?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "author_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "author_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      author_profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
      comments_public: {
        Row: {
          article_id: string | null
          body: string | null
          created_at: string | null
          id: string | null
          name: string | null
          parent_id: string | null
        }
        Insert: {
          article_id?: string | null
          body?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          parent_id?: string | null
        }
        Update: {
          article_id?: string | null
          body?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      assign_journalist: {
        Args: { p_article_id: string; p_category: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      trigger_newsroom_scan: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user" | "editor" | "contributor" | "viewer"
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
      app_role: ["admin", "user", "editor", "contributor", "viewer"],
    },
  },
} as const
