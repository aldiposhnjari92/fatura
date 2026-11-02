export interface Client {
  id: string;
  owner_id: string;
  name: string;
  email: string | null;
  nipt: string | null;
  address: string | null;
  created_at: string;
}

export interface ClientUsage {
  count: number;
  total: number;
}

export interface ClientsManagerProps {
  clients: Client[];
  /** Per-client invoice count and billed total, aggregated server-side. */
  stats?: Record<string, ClientUsage>;
}

export interface ClientDraft {
  id: string | null;
  name: string;
  nipt: string;
  email: string;
  address: string;
}
