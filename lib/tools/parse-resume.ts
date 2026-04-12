import {
  candidateProfileSchema,
  type CandidateProfile,
  type IndexedChunk
} from "@/lib/schemas";
import { generateJson } from "@/lib/tools/model";
import { tokenize } from "@/lib/utils";

type ParseResumeInput = {
  text?: string;
  chunks?: IndexedChunk[];
};

type ResumeParseOutput = {
  rawText: string;
  candidateProfile: CandidateProfile;
  evidenceMap: Record<string, string[]>;
};

const SECTION_ALIASES: Record<string, string> = {
  education: "education",
  workexperience: "work_experience",
  experience: "work_experience",
  researchandextracurricularexperience: "research_experience",
  researchexperience: "research_experience",
  extracurricularexperience: "research_experience",
  projects: "projects",
  projectexperience: "projects",
  technicalskills: "skills",
  skills: "skills",
  additionalinformation: "additional_information",
  honors: "additional_information"
};

function buildEvidenceMap(chunks: IndexedChunk[] = []) {
  return chunks.reduce<Record<string, string[]>>((map, chunk) => {
    map[chunk.id] = [chunk.text];
    return map;
  }, {});
}

function splitSections(text: string) {
  const lines = text.split("\n");
  const sections: Record<string, string[]> = { general: [] };
  let current = "general";

  lines.forEach((line) => {
    const trimmed = line.trim();
    const normalized = trimmed.toLowerCase().replace(/[^a-z]/g, "");
    const matched = SECTION_ALIASES[normalized];
    if (matched) {
      current = matched;
      sections[current] = [];
      return;
    }

    if (!sections[current]) {
      sections[current] = [];
    }

    sections[current].push(line);
  });

  return sections;
}

function normalizeResumeLine(line: string) {
  return line
    .replace(/[鈻■▪•●]/g, "-")
    .replace(/[鈥–—]/g, "-")
    .replace(/[脳×]/g, "x")
    .replace(/\s+/g, " ")
    .trim();
}

function isBulletLine(line: string) {
  const normalized = line.trim();
  return /^[-*+]/.test(normalized);
}

function stripBulletPrefix(line: string) {
  return normalizeResumeLine(line).replace(/^[-*+]\s*/, "");
}

function stripTrailingLocation(line: string) {
  const normalized = normalizeResumeLine(line);
  return normalized.replace(/\s+[A-Z][A-Za-z.' -]+,\s*[A-Z]{2}$/u, "").trim() || normalized;
}

function hasDateSignal(line: string) {
  return /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4}|Present|\d{4}\s*[-–]/i.test(
    line
  );
}

function parseRoleHeader(line: string) {
  const normalized = normalizeResumeLine(line);
  const match = normalized.match(
    /(.*?)(?=\s{2,}(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)|\s{2,}\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4}|Present|\d{4}\s*[-–])(.+)?/i
  );

  if (match && match[1]) {
    const title = match[1].trim();
    const date = normalized.slice(match[1].length).trim();
    return {
      title: title || "Experience",
      date: date || undefined
    };
  }

  return {
    title: normalized || "Experience",
    date: undefined
  };
}

function parseExperienceSection(
  lines: string[],
  evidenceRefs: ReturnType<typeof buildEvidenceRefs>
) {
  const normalizedLines = lines
    .map((line) => normalizeResumeLine(line))
    .filter(Boolean)
    .filter((line) => !/^technical skills:?$/i.test(line) && !/^honors:?$/i.test(line));

  const experiences: CandidateProfile["experience"] = [];
  let index = 0;

  while (index < normalizedLines.length) {
    const companyLine = normalizedLines[index];
    const roleLine = normalizedLines[index + 1] ?? "";

    if (!companyLine || isBulletLine(companyLine)) {
      index += 1;
      continue;
    }

    if (!roleLine || isBulletLine(roleLine) || !hasDateSignal(roleLine)) {
      index += 1;
      continue;
    }

    const parsedHeader = parseRoleHeader(roleLine);
    const bullets: string[] = [];
    index += 2;

    while (index < normalizedLines.length) {
      const current = normalizedLines[index];
      const next = normalizedLines[index + 1] ?? "";

      if (!isBulletLine(current) && next && hasDateSignal(next) && !isBulletLine(next)) {
        break;
      }

      if (isBulletLine(current)) {
        bullets.push(stripBulletPrefix(current));
      } else if (bullets.length) {
        bullets[bullets.length - 1] = `${bullets[bullets.length - 1]} ${current}`.trim();
      }

      index += 1;
    }

    experiences.push({
      title: parsedHeader.title,
      company: stripTrailingLocation(companyLine) || undefined,
      date: parsedHeader.date,
      bullets,
      evidenceRefs
    });
  }

  return experiences;
}

function parseEducationSection(
  lines: string[],
  evidenceRefs: ReturnType<typeof buildEvidenceRefs>
) {
  const normalizedLines = lines.map((line) => normalizeResumeLine(line)).filter(Boolean);
  if (!normalizedLines.length) {
    return [];
  }

  const [schoolLine, degreeLine, ...rest] = normalizedLines;
  return [
    {
      school: stripTrailingLocation(schoolLine) || "Education",
      degree: degreeLine || undefined,
      highlights: rest.filter((line) => isBulletLine(line)).map(stripBulletPrefix),
      evidenceRefs
    }
  ];
}

function parseSkillsFromSections(sections: Record<string, string[]>) {
  const candidateLines = [
    ...(sections.skills ?? []),
    ...(sections.additional_information ?? [])
  ]
    .map((line) => normalizeResumeLine(line))
    .filter(Boolean);

  const technicalLine = candidateLines.find((line) => /^technical skills:/i.test(line));
  const rawSkills = technicalLine
    ? technicalLine.replace(/^technical skills:\s*/i, "")
    : candidateLines.join(" ");

  return rawSkills
    .split(/[|,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 1);
}

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

function buildEvidenceRefs(chunks: IndexedChunk[] = [], titleFallback: string) {
  return chunks.slice(0, 6).map((chunk) => ({
    sourceId: chunk.sourceId,
    chunkId: chunk.id,
    kind: chunk.kind,
    title: chunk.metadata.sourceTitle ?? titleFallback,
    excerpt: chunk.text.slice(0, 160)
  }));
}

function normalizeCandidateProfile(
  raw: unknown,
  fallback: CandidateProfile,
  chunks: IndexedChunk[] = []
) {
  const candidate =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const evidenceRefs = buildEvidenceRefs(chunks, "Resume");

  const education = Array.isArray(candidate.education) && candidate.education.length
    ? candidate.education.map((item) => {
        const entry =
          item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        return {
          school:
            pickFirstString(
              entry.school,
              entry.institution,
              entry.university,
              entry.name
            ) || "Education",
          degree: pickFirstString(
            entry.degree,
            entry.program,
            entry.field,
            entry.fieldOfStudy,
            entry.major
          ),
          date: pickFirstString(entry.date, entry.years, entry.timeline),
          highlights: coerceStringArray(
            entry.highlights ?? entry.details ?? entry.bullets
          ),
          evidenceRefs
        };
      })
    : fallback.education;

  const experience = Array.isArray(candidate.experience) && candidate.experience.length
    ? candidate.experience.map((item) => {
        const entry =
          item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const company = pickFirstString(
          entry.company,
          entry.organization,
          entry.employer
        );
        return {
          title:
            pickFirstString(entry.title, entry.role, entry.position, entry.name) ||
            company ||
            "Experience",
          company: company || undefined,
          date: pickFirstString(entry.date, entry.duration, entry.timeline, entry.years) || undefined,
          bullets: coerceStringArray(
            entry.bullets ?? entry.highlights ?? entry.details ?? entry.description
          ),
          evidenceRefs
        };
      })
    : fallback.experience;

  const projects = Array.isArray(candidate.projects) && candidate.projects.length
    ? candidate.projects.map((item) => {
        const entry =
          item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        return {
          name:
            pickFirstString(entry.name, entry.title, entry.project) || "Project",
          description: coerceStringArray(
            entry.description ?? entry.highlights ?? entry.bullets ?? entry.details
          ),
          technologies: coerceStringArray(
            entry.technologies ?? entry.tools ?? entry.skills
          ),
          evidenceRefs
        };
      })
    : fallback.projects;

  const parsed = candidateProfileSchema.safeParse({
    name: pickFirstString(candidate.name, fallback.name) || "Candidate",
    summary: pickFirstString(candidate.summary, fallback.summary),
    education,
    skills:
      coerceStringArray(candidate.skills).length > 0
        ? coerceStringArray(candidate.skills)
        : fallback.skills,
    experience,
    projects,
    domains:
      coerceStringArray(candidate.domains).length > 0
        ? coerceStringArray(candidate.domains)
        : fallback.domains,
    evidenceRefs
  });

  return parsed.success ? parsed.data : fallback;
}

function fallbackResumeParse(text: string, chunks: IndexedChunk[] = []): CandidateProfile {
  const sections = splitSections(text);
  const nonEmptyLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const name = nonEmptyLines[0] ?? "Candidate";
  const summary = sections.general?.slice(1, 3).join(" ").trim() ?? "";
  const skills = parseSkillsFromSections(sections);

  const projectBlocks = (sections.projects ?? [])
    .join("\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const evidenceRefs = buildEvidenceRefs(chunks, "Resume").map((item) => ({
    ...item,
    excerpt: item.excerpt.slice(0, 140)
  }));

  const domains: string[] = [];
  const fullText = text.toLowerCase();
  if (fullText.includes("ai") || fullText.includes("machine learning")) {
    domains.push("AI");
  }
  if (fullText.includes("product")) {
    domains.push("Product");
  }
  if (fullText.includes("data")) {
    domains.push("Data");
  }
  if (fullText.includes("career")) {
    domains.push("Career mobility");
  }

  return candidateProfileSchema.parse({
    name,
    summary,
    education: parseEducationSection(sections.education ?? [], evidenceRefs),
    skills,
    experience: [
      ...parseExperienceSection(sections.work_experience ?? [], evidenceRefs),
      ...parseExperienceSection(sections.research_experience ?? [], evidenceRefs)
    ],
    projects: projectBlocks.map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const nameLine = lines.find((line) => !line.startsWith("-")) ?? "Project";
      return {
        name: nameLine,
        description: lines
          .filter((line) => line.startsWith("-"))
          .map((line) => line.replace(/^-+\s*/, "")),
        technologies: skills.filter((skill) =>
          tokenize(block).includes(skill.toLowerCase())
        ),
        evidenceRefs
      };
    }),
    domains,
    evidenceRefs
  });
}

export async function extractTextFromUpload(file: globalThis.File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileName = file.name;
  const mimeType = file.type;
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (mimeType.includes("pdf") || extension === "pdf") {
    try {
      const pdfParseModule = await import("pdf-parse");
      const pdfParse = (pdfParseModule.default ?? pdfParseModule) as (
        data: Buffer
      ) => Promise<{ text: string }>;
      const parsed = await pdfParse(buffer);
      return { text: parsed.text, mimeType, filename: fileName };
    } catch {
      return { text: buffer.toString("utf8"), mimeType, filename: fileName };
    }
  }

  if (
    mimeType.includes("word") ||
    extension === "docx" ||
    extension === "doc"
  ) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return { text: result.value, mimeType, filename: fileName };
    } catch {
      return { text: buffer.toString("utf8"), mimeType, filename: fileName };
    }
  }

  const text = new TextDecoder().decode(buffer);
  return { text, mimeType, filename: fileName };
}

export async function parseResume({
  text = "",
  chunks = []
}: ParseResumeInput): Promise<ResumeParseOutput> {
  const fallbackProfile = fallbackResumeParse(text, chunks);
  const prompt = [
    "You are ResumeEvidenceAgent for CareerFlow AI.",
    "Extract a grounded CandidateProfile from the resume text below.",
    "Rules:",
    "- Never invent facts, dates, or metrics.",
    "- Keep only evidence-backed skills and experiences.",
    "- Return strict JSON with keys: name, summary, education, skills, experience, projects, domains, evidenceRefs.",
    "- evidenceRefs can be an empty array because the app will attach chunk references separately.",
    "",
    text
  ].join("\n");

  const result = await generateJson(prompt, () => fallbackProfile);
  const candidateProfile = normalizeCandidateProfile(result.data, fallbackProfile, chunks);

  return {
    rawText: text,
    candidateProfile,
    evidenceMap: buildEvidenceMap(chunks)
  };
}
