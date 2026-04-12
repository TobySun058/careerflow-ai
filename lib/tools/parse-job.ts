import {
  jobProfileSchema,
  type IndexedChunk,
  type JobProfile
} from "@/lib/schemas";
import { generateJson } from "@/lib/tools/model";

function coerceString(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

function pickFirstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = coerceString(value);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function coerceStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    const single = coerceString(value);
    return single ? [single] : [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => coerceString(item))
        .filter(Boolean)
    )
  );
}

function buildSourceRefs(chunks: IndexedChunk[] = []) {
  return chunks.slice(0, 6).map((chunk) => ({
    sourceId: chunk.sourceId,
    chunkId: chunk.id,
    kind: chunk.kind,
    title: chunk.metadata.sourceTitle ?? "Job description",
    excerpt: chunk.text.slice(0, 160)
  }));
}

function normalizeJobProfile(raw: unknown, fallback: JobProfile, chunks: IndexedChunk[] = []) {
  const candidate =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const parsed = jobProfileSchema.safeParse({
    title: pickFirstString(candidate.title, candidate.role, candidate.position, fallback.title) || "Role",
    company:
      pickFirstString(candidate.company, candidate.employer, candidate.organization, fallback.company) ||
      "Unknown Company",
    summary: pickFirstString(candidate.summary, fallback.summary),
    requiredSkills:
      coerceStringArray(candidate.requiredSkills).length > 0
        ? coerceStringArray(candidate.requiredSkills)
        : fallback.requiredSkills,
    preferredSkills:
      coerceStringArray(candidate.preferredSkills).length > 0
        ? coerceStringArray(candidate.preferredSkills)
        : fallback.preferredSkills,
    responsibilities:
      coerceStringArray(candidate.responsibilities).length > 0
        ? coerceStringArray(candidate.responsibilities)
        : fallback.responsibilities,
    keywords:
      coerceStringArray(candidate.keywords).length > 0
        ? coerceStringArray(candidate.keywords)
        : fallback.keywords,
    sourceRefs: buildSourceRefs(chunks)
  });

  return parsed.success ? parsed.data : fallback;
}

type ParseJobInput = {
  text: string;
  chunks?: IndexedChunk[];
};

function fallbackJobParse(text: string, chunks: IndexedChunk[] = []): JobProfile {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const title = lines[0] ?? "Role";
  const company = lines[1] ?? "Unknown Company";

  const requirementLines = lines.filter((line) =>
    /(experience|familiarity|comfort|requirements|must|should|nice to have)/i.test(line)
  );
  const responsibilities = lines.filter((line) =>
    /^[-*]/.test(line) || /(build|collaborate|improve|design|measure|ship)/i.test(line)
  );

  const skills = Array.from(
    new Set(
      text.match(
        /\b(TypeScript|JavaScript|React|Next\.js|Next.js|Python|SQL|Firebase|RAG|LLM|APIs|backend|frontend|prompt engineering|retrieval)\b/gi
      ) ?? []
    )
  );

  const refs = buildSourceRefs(chunks);

  return jobProfileSchema.parse({
    title,
    company,
    summary: lines.slice(2, 5).join(" "),
    requiredSkills: skills.slice(0, 6),
    preferredSkills: skills.slice(6),
    responsibilities: responsibilities
      .map((line) => line.replace(/^[-*]\s*/, ""))
      .slice(0, 8),
    keywords: Array.from(new Set([...skills, ...requirementLines])).slice(0, 12),
    sourceRefs: refs
  });
}

export async function parseJobDescription({
  text,
  chunks = []
}: ParseJobInput): Promise<{ jobProfile: JobProfile }> {
  const fallbackProfile = fallbackJobParse(text, chunks);
  const prompt = [
    "You are RoleResearchAgent for CareerFlow AI.",
    "Extract a grounded JobProfile from the text below.",
    "Rules:",
    "- Use only the provided opportunity-store text.",
    "- Distinguish requiredSkills from preferredSkills when possible.",
    "- Return strict JSON with keys: title, company, summary, requiredSkills, preferredSkills, responsibilities, keywords, sourceRefs.",
    "",
    text
  ].join("\n");

  const result = await generateJson(prompt, () => fallbackProfile);
  const jobProfile = normalizeJobProfile(result.data, fallbackProfile, chunks);

  return { jobProfile };
}
