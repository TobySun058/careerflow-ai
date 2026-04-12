import { z } from "zod";

export const sourceKindSchema = z.enum(["truth", "opportunity"]);
export type SourceKind = z.infer<typeof sourceKindSchema>;

export const sourceSubtypeSchema = z.enum([
  "resume",
  "supporting_doc",
  "saved_bullet",
  "interview_story",
  "user_note",
  "job_description",
  "job_url",
  "company_page",
  "job_search"
]);
export type SourceSubtype = z.infer<typeof sourceSubtypeSchema>;

export const evidenceRefSchema = z.object({
  sourceId: z.string(),
  chunkId: z.string(),
  kind: sourceKindSchema,
  title: z.string(),
  excerpt: z.string()
});
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;

export const sourceChunkSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  kind: sourceKindSchema,
  text: z.string(),
  tokenCount: z.number(),
  metadata: z.record(z.string(), z.string()).default({})
});
export type SourceChunk = z.infer<typeof sourceChunkSchema>;

export const indexedChunkSchema = sourceChunkSchema.extend({
  embedding: z.array(z.number()).optional()
});
export type IndexedChunk = z.infer<typeof indexedChunkSchema>;

export const sourceDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: sourceKindSchema,
  subtype: sourceSubtypeSchema,
  content: z.string(),
  preview: z.string(),
  createdAt: z.string(),
  metadata: z
    .object({
      filename: z.string().optional(),
      url: z.string().optional(),
      mimeType: z.string().optional(),
      chunkCount: z.number().optional()
    })
    .default({}),
  chunkIds: z.array(z.string()).default([])
});
export type SourceDocument = z.infer<typeof sourceDocumentSchema>;

export const educationItemSchema = z.object({
  school: z.string(),
  degree: z.string().optional(),
  date: z.string().optional(),
  highlights: z.array(z.string()).default([]),
  evidenceRefs: z.array(evidenceRefSchema).default([])
});
export type EducationItem = z.infer<typeof educationItemSchema>;

export const experienceItemSchema = z.object({
  title: z.string(),
  company: z.string().optional(),
  date: z.string().optional(),
  bullets: z.array(z.string()).default([]),
  evidenceRefs: z.array(evidenceRefSchema).default([])
});
export type ExperienceItem = z.infer<typeof experienceItemSchema>;

export const projectItemSchema = z.object({
  name: z.string(),
  description: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
  evidenceRefs: z.array(evidenceRefSchema).default([])
});
export type ProjectItem = z.infer<typeof projectItemSchema>;

export const candidateProfileSchema = z.object({
  name: z.string().default("Candidate"),
  summary: z.string().default(""),
  education: z.array(educationItemSchema).default([]),
  skills: z.array(z.string()).default([]),
  experience: z.array(experienceItemSchema).default([]),
  projects: z.array(projectItemSchema).default([]),
  domains: z.array(z.string()).default([]),
  evidenceRefs: z.array(evidenceRefSchema).default([])
});
export type CandidateProfile = z.infer<typeof candidateProfileSchema>;

export const jobProfileSchema = z.object({
  title: z.string().default("Role"),
  company: z.string().default("Unknown Company"),
  summary: z.string().default(""),
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  sourceRefs: z.array(evidenceRefSchema).default([])
});
export type JobProfile = z.infer<typeof jobProfileSchema>;

export const matchReportSchema = z.object({
  fitScore: z.number().min(0).max(100),
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  recommendedEmphasis: z.array(z.string()).default([]),
  priorityKeywords: z.array(z.string()).default([]),
  sourceRefs: z.array(evidenceRefSchema).default([])
});
export type MatchReport = z.infer<typeof matchReportSchema>;

export const claimMapEntrySchema = z.object({
  id: z.string(),
  text: z.string(),
  supportingChunkIds: z.array(z.string()).default([]),
  sourceType: sourceKindSchema,
  confidence: z.number().min(0).max(1),
  status: z.enum(["supported", "suggested", "unsupported"]).default("supported")
});
export type ClaimMapEntry = z.infer<typeof claimMapEntrySchema>;

export const artifactTypeSchema = z.enum([
  "match",
  "resume_rewrite",
  "outreach",
  "linkedin_note",
  "cover_letter",
  "why_this_role",
  "interview_prep",
  "plan",
  "job_search",
  "ats_resume"
]);
export type ArtifactType = z.infer<typeof artifactTypeSchema>;

export const draftArtifactSchema = z.object({
  id: z.string(),
  type: artifactTypeSchema,
  title: z.string(),
  content: z.string(),
  claimMap: z.array(claimMapEntrySchema).default([]),
  sourceRefs: z.array(evidenceRefSchema).default([]),
  editable: z.boolean().default(true)
});
export type DraftArtifact = z.infer<typeof draftArtifactSchema>;

export const workflowTraceStepSchema = z.object({
  id: z.string(),
  agent: z.string(),
  status: z.enum(["queued", "running", "completed", "skipped", "failed"]),
  summary: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  artifactIds: z.array(z.string()).default([])
});
export type WorkflowTraceStep = z.infer<typeof workflowTraceStepSchema>;

export const sessionRecordSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  candidateProfile: candidateProfileSchema.nullable(),
  jobProfile: jobProfileSchema.nullable(),
  matchReport: matchReportSchema.nullable(),
  artifacts: z.array(draftArtifactSchema).default([]),
  plan: draftArtifactSchema.nullable().default(null),
  workflowTrace: z.array(workflowTraceStepSchema).default([]),
  sourceManifest: z.array(sourceDocumentSchema).default([]),
  notes: z.array(z.string()).default([])
});
export type SessionRecord = z.infer<typeof sessionRecordSchema>;

export const sourceManifestResponseSchema = z.object({
  sessionId: z.string(),
  sourceManifest: z.array(sourceDocumentSchema)
});
export type SourceManifestResponse = z.infer<typeof sourceManifestResponseSchema>;

export const workflowBundleSchema = z.object({
  session: sessionRecordSchema,
  artifacts: z.array(draftArtifactSchema),
  match: matchReportSchema.nullable(),
  workflowTrace: z.array(workflowTraceStepSchema)
});
export type WorkflowBundle = z.infer<typeof workflowBundleSchema>;

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z.string()
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const jobSearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string().default("Remote"),
  summary: z.string(),
  url: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  sourceRefs: z.array(evidenceRefSchema).default([])
});
export type JobSearchResult = z.infer<typeof jobSearchResultSchema>;
