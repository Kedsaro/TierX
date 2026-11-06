/** Row of `notifications` (RF-15). */
export interface AppNotification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';

/** Row of `reports`, enriched with the names the admin panel renders (RF-17). */
export interface Report {
  id: number;
  reporter_id: number;
  tournament_id: number | null;
  target_user_id: number | null;
  reason: string;
  details: string | null;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface ReportSummary extends Report {
  reporter_username: string;
  tournament_name: string | null;
  target_username: string | null;
}

/** Row of `audit_logs` — one entry per administrative action (RF-17). */
export interface AuditLogEntry {
  id: number;
  actor_user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: string | null;
  created_at: string;
}

export interface AuditLogSummary extends AuditLogEntry {
  actor_username: string | null;
}

/** Row of `app_settings` — a global, admin-editable parameter (RF-17). */
export interface AppSetting {
  key: string;
  value: string;
  updated_at: string;
}
