export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          role?: string;
        };
        Update: {
          email?: string | null;
          full_name?: string | null;
          role?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      venues: {
        Row: {
          id: string;
          slug: string;
          name: string;
          type: string;
          region: string;
          town: string;
          country: string;
          summary: string;
          description: string;
          price_from: number | null;
          price_to: number | null;
          capacity_min: number;
          capacity_max: number;
          hero_image: string;
          official_website_url: string | null;
          official_gallery_url: string | null;
          vendor_contact_email: string | null;
          vendor_contact_source_url: string | null;
          vendor_contact_verified_at: string | null;
          vendor_contact_verified_by: string | null;
          listing_status: "draft" | "published" | "claimed" | "archived";
          claim_status: "unclaimed" | "pending" | "approved" | "rejected";
          image_permission_status: string;
          image_credit: string | null;
          image_is_representative: boolean;
          is_claimed: boolean;
          claimed_by: string | null;
          claimed_at: string | null;
          invite_sent_at: string | null;
          invite_status: "not_sent" | "sent" | "bounced" | "replied" | "claimed";
          outreach_notes: string | null;
          latitude: number | null;
          longitude: number | null;
          is_featured: boolean;
          status: "draft" | "published";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["venues"]["Row"]> & {
          slug: string;
          name: string;
          type: string;
          region: string;
          town: string;
        };
        Update: Partial<Database["public"]["Tables"]["venues"]["Row"]>;
        Relationships: [];
      };
      vendors: {
        Row: {
          id: string;
          name: string;
          contact_email: string | null;
          contact_phone: string | null;
          status: "active" | "paused";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["vendors"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["vendors"]["Row"]>;
        Relationships: [];
      };
      vendor_users: {
        Row: {
          vendor_id: string;
          user_id: string;
          role: string;
          status: "active" | "paused";
          created_at: string;
        };
        Insert: {
          vendor_id: string;
          user_id: string;
          role?: string;
          status?: "active" | "paused";
        };
        Update: Partial<Database["public"]["Tables"]["vendor_users"]["Row"]>;
        Relationships: [];
      };
      venue_claims: {
        Row: {
          id: string;
          venue_id: string;
          claimant_user_id: string;
          claimant_name: string;
          claimant_email: string;
          claimant_role: string;
          business_email: string;
          business_phone: string;
          message: string;
          evidence_url: string | null;
          status: "pending" | "approved" | "rejected";
          admin_notes: string | null;
          permission_confirmed: boolean;
          terms_accepted: boolean;
          created_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["venue_claims"]["Row"]> & {
          venue_id: string;
          claimant_user_id: string;
          claimant_name: string;
          claimant_email: string;
          claimant_role: string;
          business_email: string;
          business_phone: string;
          message: string;
          permission_confirmed: boolean;
          terms_accepted: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["venue_claims"]["Row"]>;
        Relationships: [];
      };
      venue_claim_audit_log: {
        Row: {
          id: string;
          claim_id: string | null;
          venue_id: string | null;
          admin_user_id: string | null;
          action: string;
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["venue_claim_audit_log"]["Row"]> & {
          action: string;
        };
        Update: Partial<Database["public"]["Tables"]["venue_claim_audit_log"]["Row"]>;
        Relationships: [];
      };
      vendor_update_requests: {
        Row: {
          id: string;
          venue_id: string;
          vendor_user_id: string;
          requested_name: string | null;
          requested_summary: string | null;
          requested_description: string | null;
          requested_official_website_url: string | null;
          requested_official_gallery_url: string | null;
          requested_message: string;
          status: "pending" | "approved" | "rejected";
          admin_notes: string | null;
          created_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["vendor_update_requests"]["Row"]> & {
          venue_id: string;
          vendor_user_id: string;
          requested_message: string;
        };
        Update: Partial<Database["public"]["Tables"]["vendor_update_requests"]["Row"]>;
        Relationships: [];
      };
      venue_images: {
        Row: {
          id: string;
          venue_id: string;
          url: string;
          alt: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          venue_id: string;
          url: string;
          alt: string;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["venue_images"]["Row"]>;
        Relationships: [];
      };
      amenities: {
        Row: { id: string; slug: string; name: string };
        Insert: { slug: string; name: string };
        Update: Partial<Database["public"]["Tables"]["amenities"]["Row"]>;
        Relationships: [];
      };
      venue_amenities: {
        Row: { venue_id: string; amenity_id: string };
        Insert: { venue_id: string; amenity_id: string };
        Update: never;
        Relationships: [];
      };
      favourites: {
        Row: { user_id: string; venue_id: string; created_at: string };
        Insert: { user_id: string; venue_id: string };
        Update: never;
        Relationships: [];
      };
      enquiries: {
        Row: {
          id: string;
          venue_id: string;
          user_id: string | null;
          name: string;
          email: string;
          phone: string | null;
          wedding_date: string | null;
          guest_count: number | null;
          message: string;
          status: "new" | "contacted" | "converted" | "closed";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["enquiries"]["Row"]> & {
          venue_id: string;
          name: string;
          email: string;
          message: string;
        };
        Update: Partial<Database["public"]["Tables"]["enquiries"]["Row"]>;
        Relationships: [];
      };
      supplier_applications: {
        Row: {
          id: string;
          business_name: string;
          owner_name: string;
          email: string;
          phone: string;
          website_url: string | null;
          instagram_handle: string | null;
          facebook_url: string | null;
          location: string;
          coverage_radius_miles: number;
          category: string;
          description: string;
          services: string;
          pricing: string | null;
          gallery_urls: string | null;
          status: "pending" | "approved" | "rejected";
          admin_notes: string | null;
          terms_accepted_at: string;
          created_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["supplier_applications"]["Row"]> & {
          business_name: string;
          owner_name: string;
          email: string;
          phone: string;
          location: string;
          coverage_radius_miles: number;
          category: string;
          description: string;
          services: string;
          terms_accepted_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["supplier_applications"]["Row"]>;
        Relationships: [];
      };
      newsletter_subscribers: {
        Row: {
          id: string;
          email: string;
          status: "pending" | "active" | "unsubscribed";
          confirmation_token_hash: string | null;
          unsubscribe_token_hash: string | null;
          confirmed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["newsletter_subscribers"]["Row"]> & { email: string };
        Update: Partial<Database["public"]["Tables"]["newsletter_subscribers"]["Row"]>;
        Relationships: [];
      };
      outreach_campaigns: {
        Row: {
          id: string;
          name: string;
          kind: "initial_invite" | "follow_up";
          source: "admin" | "chatgpt";
          status: "draft" | "sending" | "sent" | "partially_sent" | "failed" | "cancelled";
          subject: string;
          preheader: string;
          intro_text: string;
          offer_text: string;
          audience_filter: Json;
          approval_fingerprint: string | null;
          recipient_count: number;
          sent_count: number;
          failed_count: number;
          skipped_count: number;
          send_attempts: number;
          created_by: string | null;
          approved_by: string | null;
          approved_at: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["outreach_campaigns"]["Row"]> & {
          name: string;
          subject: string;
          preheader: string;
          intro_text: string;
          offer_text: string;
        };
        Update: Partial<Database["public"]["Tables"]["outreach_campaigns"]["Row"]>;
        Relationships: [];
      };
      outreach_campaign_recipients: {
        Row: {
          id: string;
          campaign_id: string;
          venue_id: string | null;
          venue_slug: string;
          business_name: string;
          town: string;
          region: string;
          email: string;
          normalized_email: string;
          contact_source_url: string | null;
          status: "pending" | "sent" | "delivered" | "failed" | "bounced" | "complained" | "replied" | "unsubscribed" | "suppressed";
          resend_email_id: string | null;
          unsubscribe_token_hash: string | null;
          error_message: string | null;
          sent_at: string | null;
          delivered_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["outreach_campaign_recipients"]["Row"]> & {
          campaign_id: string;
          venue_slug: string;
          business_name: string;
          town: string;
          region: string;
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["outreach_campaign_recipients"]["Row"]>;
        Relationships: [];
      };
      outreach_suppressions: {
        Row: {
          id: string;
          email: string;
          normalized_email: string;
          reason: "unsubscribed" | "bounced" | "complained" | "provider_suppressed" | "manual";
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          reason: "unsubscribed" | "bounced" | "complained" | "provider_suppressed" | "manual";
          source?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["outreach_suppressions"]["Row"]>;
        Relationships: [];
      };
      outreach_email_events: {
        Row: {
          id: string;
          resend_email_id: string;
          event_type: string;
          event_created_at: string | null;
          received_at: string;
        };
        Insert: {
          id: string;
          resend_email_id: string;
          event_type: string;
          event_created_at?: string | null;
          received_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      enrichment_runs: {
        Row: {
          id: string;
          mode: "dry_run" | "review" | "apply" | "rollback";
          status: "pending" | "running" | "completed" | "failed" | "cancelled";
          source_fingerprint: string;
          scope: Json;
          options: Json;
          summary: Json;
          external_usage: Json;
          created_by: string | null;
          started_at: string | null;
          completed_at: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["enrichment_runs"]["Row"]> & {
          source_fingerprint: string;
        };
        Update: Partial<Database["public"]["Tables"]["enrichment_runs"]["Row"]>;
        Relationships: [];
      };
      enrichment_records: {
        Row: {
          id: string;
          run_id: string;
          entity_type: "venue" | "vendor" | "supplier_application";
          entity_id: string;
          entity_snapshot: Json;
          eligibility_blockers: string[];
          quality_blockers: string[];
          missing_fields: string[];
          business_status: "active" | "likely_active" | "temporarily_closed" | "closed" | "rebranded" | "duplicate" | "uncertain";
          research_status: "pending" | "processing" | "researched" | "verified" | "manual_review" | "failed" | "skipped";
          requires_manual_review: boolean;
          before_outreach_eligible: boolean;
          after_outreach_eligible: boolean | null;
          attempt_count: number;
          next_attempt_at: string | null;
          locked_by: string | null;
          locked_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["enrichment_records"]["Row"]> & {
          run_id: string;
          entity_type: "venue" | "vendor" | "supplier_application";
          entity_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["enrichment_records"]["Row"]>;
        Relationships: [];
      };
      business_enrichment_profiles: {
        Row: {
          entity_type: "venue" | "vendor" | "supplier_application";
          entity_id: string;
          trading_name: string | null;
          contact_page_url: string | null;
          enquiry_page_url: string | null;
          public_email: string | null;
          enquiries_email: string | null;
          wedding_email: string | null;
          sales_email: string | null;
          phone: string | null;
          full_address: string | null;
          address_line_1: string | null;
          address_line_2: string | null;
          town: string | null;
          county_region: string | null;
          country: string | null;
          postcode: string | null;
          instagram_url: string | null;
          facebook_url: string | null;
          tiktok_url: string | null;
          linkedin_url: string | null;
          services: Json;
          areas_served: Json;
          structured_pricing: Json;
          business_status: "active" | "likely_active" | "temporarily_closed" | "closed" | "rebranded" | "duplicate" | "uncertain";
          last_verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["business_enrichment_profiles"]["Row"]> & {
          entity_type: "venue" | "vendor" | "supplier_application";
          entity_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["business_enrichment_profiles"]["Row"]>;
        Relationships: [];
      };
      enrichment_field_proposals: {
        Row: {
          id: string;
          enrichment_record_id: string;
          target_table: "venues" | "business_enrichment_profiles";
          target_field: string;
          previous_value: Json | null;
          proposed_value: Json;
          source_url: string;
          source_title: string;
          source_type: "official_website" | "official_contact" | "official_pricing" | "official_social" | "official_register" | "tourism_body" | "trade_body" | "reputable_directory" | "internal_record" | "manual_research";
          source_accessed_at: string;
          confidence: "high" | "medium" | "low";
          verification_status: "verified" | "likely_valid" | "unverified" | "invalid" | "not_applicable";
          verification_method: string | null;
          reason: string;
          status: "pending" | "approved" | "rejected" | "applied" | "rolled_back" | "conflict";
          conflict_reason: string | null;
          proposal_fingerprint: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          applied_at: string | null;
          rolled_back_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["enrichment_field_proposals"]["Row"]> & {
          enrichment_record_id: string;
          target_table: "venues" | "business_enrichment_profiles";
          target_field: string;
          proposed_value: Json;
          source_url: string;
          source_title: string;
          source_type: Database["public"]["Tables"]["enrichment_field_proposals"]["Row"]["source_type"];
          source_accessed_at: string;
          confidence: "high" | "medium" | "low";
          reason: string;
        };
        Update: Partial<Database["public"]["Tables"]["enrichment_field_proposals"]["Row"]>;
        Relationships: [];
      };
      enrichment_email_checks: {
        Row: {
          id: string;
          enrichment_record_id: string;
          email: string;
          normalized_email: string;
          syntax_valid: boolean;
          domain: string | null;
          domain_exists: boolean | null;
          has_mx: boolean | null;
          mx_hosts: Json;
          is_disposable: boolean | null;
          is_role_based: boolean | null;
          known_hard_bounce: boolean | null;
          is_suppressed: boolean | null;
          is_opted_out: boolean | null;
          has_prior_outreach: boolean | null;
          domain_associated: boolean | null;
          status: "verified" | "likely_valid" | "unverified" | "invalid" | "hard_bounce" | "suppressed" | "opted_out" | "not_found";
          verification_method: string | null;
          details: Json;
          checked_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["enrichment_email_checks"]["Row"]> & {
          enrichment_record_id: string;
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["enrichment_email_checks"]["Row"]>;
        Relationships: [];
      };
      enrichment_duplicate_candidates: {
        Row: {
          id: string;
          run_id: string;
          left_entity_type: "venue" | "vendor" | "supplier_application";
          left_entity_id: string;
          right_entity_type: "venue" | "vendor" | "supplier_application";
          right_entity_id: string;
          match_reasons: Json;
          match_score: number;
          canonical_entity_type: "venue" | "vendor" | "supplier_application" | null;
          canonical_entity_id: string | null;
          status: "pending" | "confirmed" | "not_duplicate" | "merged";
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["enrichment_duplicate_candidates"]["Row"]> & {
          run_id: string;
          left_entity_type: "venue" | "vendor" | "supplier_application";
          left_entity_id: string;
          right_entity_type: "venue" | "vendor" | "supplier_application";
          right_entity_id: string;
          match_score: number;
        };
        Update: Partial<Database["public"]["Tables"]["enrichment_duplicate_candidates"]["Row"]>;
        Relationships: [];
      };
      enrichment_change_log: {
        Row: {
          id: string;
          proposal_id: string;
          run_id: string;
          enrichment_record_id: string;
          action: "applied" | "rolled_back";
          target_table: "venues" | "business_enrichment_profiles";
          target_field: string;
          previous_value: Json | null;
          new_value: Json | null;
          changed_by: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      budget_plans: {
        Row: { id: string; user_id: string; name: string; scenario_name: string; currency: "GBP" | "EUR" | "USD"; total_budget_pence: number; plan_json: Json; created_at: string; updated_at: string; };
        Insert: { id: string; user_id: string; name: string; scenario_name?: string; currency?: "GBP" | "EUR" | "USD"; total_budget_pence?: number; plan_json: Json; created_at?: string; updated_at?: string; };
        Update: Partial<Database["public"]["Tables"]["budget_plans"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      apply_enrichment_proposal: {
        Args: { p_proposal_id: string; p_reviewer_id: string };
        Returns: Database["public"]["Tables"]["enrichment_field_proposals"]["Row"];
      };
      rollback_enrichment_proposal: {
        Args: { p_proposal_id: string; p_reviewer_id: string };
        Returns: Database["public"]["Tables"]["enrichment_field_proposals"]["Row"];
      };
      claim_enrichment_records: {
        Args: { p_run_id: string; p_worker_id: string; p_limit?: number };
        Returns: Database["public"]["Tables"]["enrichment_records"]["Row"][];
      };
    };
    Enums: {
      venue_status: "draft" | "published";
      enquiry_status: "new" | "contacted" | "converted" | "closed";
    };
    CompositeTypes: Record<string, never>;
  };
};
