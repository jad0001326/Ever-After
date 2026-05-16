export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: "user" | "admin";
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: "user" | "admin";
        };
        Update: {
          full_name?: string | null;
          role?: "user" | "admin";
        };
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
          price_from: number;
          price_to: number;
          capacity_min: number;
          capacity_max: number;
          hero_image: string;
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
      };
      amenities: {
        Row: { id: string; slug: string; name: string };
        Insert: { slug: string; name: string };
        Update: Partial<Database["public"]["Tables"]["amenities"]["Row"]>;
      };
      venue_amenities: {
        Row: { venue_id: string; amenity_id: string };
        Insert: { venue_id: string; amenity_id: string };
        Update: never;
      };
      favourites: {
        Row: { user_id: string; venue_id: string; created_at: string };
        Insert: { user_id: string; venue_id: string };
        Update: never;
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
          status: "new" | "contacted" | "closed";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["enquiries"]["Row"]> & {
          venue_id: string;
          name: string;
          email: string;
          message: string;
        };
        Update: Partial<Database["public"]["Tables"]["enquiries"]["Row"]>;
      };
    };
  };
};
