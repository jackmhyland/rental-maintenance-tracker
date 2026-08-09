export type Priority = "Emergency" | "High" | "Medium" | "Low";

export type RecommendationDecision = "accepted" | "overridden";

export interface MaintenanceRequest {
  id: number;
  property: string;
  tenant_name: string;
  preferred_contact: string | null;
  request_title: string;
  description: string;
  received_via: string | null;
  date_received: string;
  status: string;
  claude_priority: Priority | null;
  claude_explanation: string | null;
  claude_suggested_action: string | null;
  recommendation_decision: RecommendationDecision | null;
  final_priority: Priority | null;
  responsible_party: string | null;
  notes: string | null;
  needs_follow_up: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}
