// The one interface every screen uses. lib/mock-data.ts implements it on bundled synthetic data
// (in the browser), lib/live-data.ts on Snowflake (on the server).
import type { AskResult, ComposeResult, Conflict, Inventory, Monitor, Overview } from './types';

export interface ContextData {
  overview(): Promise<Overview>;
  ask(questionId: string): Promise<AskResult>;
  inventory(): Promise<Inventory>;
  mine(docId: string): Promise<{ term: string; definition: string; source: 'mock' | 'snowflake'; latencyMs?: number }>;
  conflicts(): Promise<Conflict[]>;
  explain(conflictId: string): Promise<{ text: string; source: 'mock' | 'snowflake'; latencyMs?: number }>;
  approve(conflictId: string, docId: string, note: string): Promise<{ ok: true; message: string; source: 'mock' | 'snowflake'; latencyMs?: number }>;
  compose(question: string): Promise<ComposeResult>;
  monitor(): Promise<Monitor>;
  runEval(): Promise<{ runId: string; source: 'mock' | 'snowflake'; latencyMs?: number }>;
}

export const OPS: (keyof ContextData)[] = ['overview', 'ask', 'inventory', 'mine', 'conflicts', 'explain', 'approve', 'compose', 'monitor', 'runEval'];
