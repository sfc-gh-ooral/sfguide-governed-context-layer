// Shared shapes for both data sources (bundled sample data and live Snowflake).

export type Source = 'mock' | 'snowflake';
export interface Provenance { source: Source; latencyMs?: number }

export interface Question { id: string; question: string; topic: string }

export interface AgentAnswer { agent: string; text: string; tools?: string[] }
export interface AskResult extends Provenance {
  questionId: string;
  ungovernedA: AgentAnswer; ungovernedB: AgentAnswer;
  governedA: AgentAnswer; governedB: AgentAnswer;
  ungovernedAgree: boolean; governedAgree: boolean;
  judgeNote: string;
}

export type TermStatus = 'draft' | 'conflict' | 'missing' | 'approved';
export interface Term {
  id: string; term: string; domain: string; kind: string; definition: string;
  owner: string; source: 'wiki' | 'bi' | 'inferred'; sourceRef: string; status: TermStatus;
  svName: string | null; svExpression: string | null; synonyms: string[];
  approvedBy?: string | null; approvedAt?: string | null; note?: string | null;
}
export interface Candidate { docId: string; title: string; owner: string; updated: string; pageStatus: string; term: string; definition: string }
export interface BiMetric { name: string; label: string; expression: string; owner: string; inSemanticView: boolean }
export interface Inventory extends Provenance { terms: Term[]; candidates: Candidate[]; bi: BiMetric[]; svStatus: Record<string, string> }

export interface ConflictOption { docId: string; label: string; definition: string; svExpression: string | null; chosen: boolean }
export interface Conflict { id: string; termId: string; term: string; owner: string; kind: string; options: ConflictOption[]; explanation: string; resolved: boolean }

export interface ComposeResult extends Provenance { question: string; tools: string[]; text: string }

export interface EvalPoint { day: string; governed: number | null; ungoverned: number | null; seeded: boolean }
export interface EvalRow { questionId: string; question: string; pair: 'governed' | 'ungoverned'; agree: boolean; note: string }
export interface Monitor extends Provenance { history: EvalPoint[]; latest: EvalRow[]; latestRunAt: string | null; taskState: string; questions: Question[] }

export interface Overview extends Provenance {
  questions: Question[];
  openConflicts: number; approvedTerms: number; totalTerms: number;
  governedAgreement: number | null; ungovernedAgreement: number | null;
}
