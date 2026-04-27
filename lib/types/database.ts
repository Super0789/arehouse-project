// Minimal DB types for Phase 2. Replace with generated types once available:
//   supabase gen types typescript --project-id <id> --schema public > lib/types/database.ts

export type UserRole = "admin" | "supervisor" | "viewer";
export type SessionStatus = "draft" | "morning_submitted" | "closed";
export type MovementType =
  | "opening_stock"
  | "distributed"
  | "returned"
  | "adjustment";

export interface Team {
  id: string;
  team_name: string;
  area: string | null;
  active: boolean;
  created_at: string;
}

export interface Supervisor {
  id: string;
  full_name: string;
  team_id: string;
  phone: string | null;
  active: boolean;
  created_at: string;
}

export interface Promoter {
  id: string;
  full_name: string;
  team_id: string;
  supervisor_id: string;
  active: boolean;
  created_at: string;
}

export interface Item {
  id: string;
  item_name: string;
  item_code: string | null;
  category: string | null;
  unit: string;
  active: boolean;
  created_at: string;
}

export interface SupervisorStock {
  id: string;
  supervisor_id: string;
  item_id: string;
  quantity_on_hand: number;
  updated_at: string;
}

export type WarehouseMovementType = "received" | "transfer_out" | "adjustment";

export interface WarehouseStock {
  id: string;
  item_id: string;
  quantity_on_hand: number;
  updated_at: string;
}

export interface WarehouseMovement {
  id: string;
  movement_type: WarehouseMovementType;
  item_id: string;
  qty: number;
  supervisor_id: string | null;
  related_stock_movement_id: string | null;
  movement_date: string;
  notes: string | null;
  created_by: string | null;
}

export interface DailySession {
  id: string;
  session_date: string;
  team_id: string;
  supervisor_id: string;
  status: SessionStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  morning_submitted_at: string | null;
  closed_at: string | null;
}

export interface MorningDistributionRow {
  id: string;
  daily_session_id: string;
  promoter_id: string;
  item_id: string;
  qty_given: number;
  created_at: string;
  created_by: string | null;
}

export interface PromoterClosingRow {
  id: string;
  daily_session_id: string;
  promoter_id: string;
  item_id: string;
  qty_remaining: number;
  created_at: string;
  created_by: string | null;
}

export interface StockMovement {
  id: string;
  movement_type: MovementType;
  supervisor_id: string;
  promoter_id: string | null;
  item_id: string;
  qty: number;
  session_id: string | null;
  movement_date: string;
  notes: string | null;
  created_by: string | null;
}

export interface UserProfile {
  id: string;
  full_name: string;
  role: UserRole;
  linked_supervisor_id: string | null;
  linked_team_id: string | null;
  active: boolean;
  created_at: string;
}