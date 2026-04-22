export type ItemKind = 'content' | 'app';

export interface ItemRow {
  id: string;
  kind: ItemKind;
  title: string;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
  url: string;
  locale: string | null;
  country: string | null;
  tags: string[] | null;
  rank: number;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      items: {
        Row: ItemRow;
        Insert: Omit<ItemRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<ItemRow>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
