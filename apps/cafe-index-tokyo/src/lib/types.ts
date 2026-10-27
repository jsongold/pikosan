export type Conf = 'high' | 'medium' | 'low' | string;
export type Value = string | number | boolean | Value[] | { [k: string]: Value };
export interface Attr { v: Value; conf?: Conf; src?: string[]; at?: string; label: string }
export interface Facet { v: string; n: number; label?: string }
export interface Axis { key: string; label: string; atmos?: boolean; scale?: [number, number]; values?: string[] }
export interface ShopRow {
  id: number; name: string; kana?: string; ward?: string; station?: string;
  genres?: string[]; mood?: string[]; score?: number; reviews?: number;
  price?: string; priceMin?: number; priceMax?: number; feats?: string[];
}
export interface ShopIndex {
  total: number;
  facets: { wards: Facet[]; genres: Facet[]; features: Facet[] };
  axes: Axis[];
  shops: ShopRow[];
}
export interface MenuItem { name: string; price?: number; note?: string; src?: string; section?: string; mt?: boolean; nameSource?: string }
export interface Review { summary: string; sentiment?: string; rating?: number; date?: string; source?: string; url?: string }
export interface EventLite {
  id: number; type: string; typeLabel?: string; title: string; starts_at?: string; date_text?: string;
  recurrence?: string; status?: string; booking_url?: string; sources?: string[]; linkBy?: string;
}
export interface ShopDetail {
  id: number; name: string; kana?: string; prefecture?: string; ward?: string; address?: string;
  lat?: number; lng?: number; sources?: string[]; updated?: string; feats?: string[];
  uid?: string; regionKey?: string;
  attrs: Record<string, Attr>; menu?: MenuItem[]; reviews?: Review[]; events?: EventLite[];
}
export interface CafeEvent extends EventLite {
  event_uid: string; ends_at?: string; venue_name?: string; venue_address?: string; venue_ward?: string;
  venue_lat?: number; venue_lng?: number; organizer?: string; fee_text?: string; description?: string;
  extra?: Record<string, Value>; confidence?: Conf; last_verified?: string; shop_id?: number;
}
export interface EventsFile { types: Record<string, string>; total: number; groups: { upcoming: CafeEvent[]; recurring: CafeEvent[]; past: CafeEvent[] } }
export interface Meta {
  exportedAt: string;
  shops: number;
  events: number;
  menuItems: number;
  reviews: number;
  linkedEvents: number;
  /** Set only on the labelled fixtures/demo set. Real exports and Supabase omit this. */
  demo?: boolean;
  note?: string;
}
