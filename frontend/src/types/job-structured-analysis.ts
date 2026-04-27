export interface JobStructuredAnalysis {
  id: number;
  jobId: number;
  jobDirection: string | null;
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  candidateRequirements: string[];
  riskPoints: string[];
  openerFocus: string | null;
  summary: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
