/** The governed agent catalogue (schema/agents/agents.json) and the master manifest agents read through. */
import agents from "../../../schema/agents/agents.json";
import masters from "../../../schema/aip-masters.json";

export type Role = "viewer" | "planner" | "admin";
export const ROLE_RANK: Record<Role, number> = { viewer: 0, planner: 1, admin: 2 };

export type ToolName = "list_masters" | "query_master" | "get_record" | "model_catalogue" | "latest_model_outputs" | "top_risks" | "list_proposals" | "create_proposal";

export interface AgentDefinition {
  id: string;
  name: string;
  summary: string;
  screens: string[];
  minRole: Role;
  tools: ToolName[];
  proposalTypes: string[];
  instructions: string;
}

export interface MasterColumnInfo {
  name: string;
  label: string;
  kind: string;
  ref?: string;
  scope?: string;
  fk?: string;
}
export interface MasterInfo {
  name: string;
  label: string;
  layer: string;
  description: string;
  view: string;
  columns: MasterColumnInfo[];
}

export const AGENTS: AgentDefinition[] = (agents as { agents: AgentDefinition[] }).agents;
export const MASTERS: MasterInfo[] = (masters as { masters: MasterInfo[] }).masters;

export function agent(id: string): AgentDefinition | undefined {
  return AGENTS.find((a) => a.id === id);
}

export const canUse = (a: AgentDefinition, role: Role) => ROLE_RANK[role] >= ROLE_RANK[a.minRole];
