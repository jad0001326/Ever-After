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
      budget_plans: {
        Row: { id: string; user_id: string; name: string; scenario_name: string; currency: "GBP" | "EUR" | "USD"; total_budget_pence: number; plan_json: Json; created_at: string; updated_at: string; };
        Insert: { id: string; user_id: string; name: string; scenario_name?: string; currency?: "GBP" | "EUR" | "USD"; total_budget_pence?: number; plan_json: Json; created_at?: string; updated_at?: string; };
        Update: Partial<Database["public"]["Tables"]["budget_plans"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      venue_status: "draft" | "published";
      enquiry_status: "new" | "contacted" | "converted" | "closed";
    };
    CompositeTypes: Record<string, never>;
  };
};
