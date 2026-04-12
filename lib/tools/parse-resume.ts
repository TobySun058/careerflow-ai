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

const SECTION_TITLES = ["education", "skills", "experience", "projects"];

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
    const matched = SECTION_TITLES.find((title) => normalized === title);
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

function fallbackResumeParse(text: string, chunks: IndexedChunk[] = []): CandidateProfile {
  const sections = splitSections(text);
  const nonEmptyLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const name = nonEmptyLines[0] ?? "Candidate";
  const summary = sections.general?.slice(1, 3).join(" ").trim() ?? "";
  const skills = (sections.skills ?? [])
    .join(" ")
    .split(/[,\u2022|]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 1);

  const educationBlocks = (sections.education ?? [])
    .join("\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const experienceBlocks = (sections.experience ?? [])
    .join("\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const projectBlocks = (sections.projects ?? [])
    .join("\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const evidenceRefs = chunks.slice(0, 4).map((chunk) => ({
    sourceId: chunk.sourceId,
    chunkId: chunk.id,
    kind: chunk.kind,
    title: chunk.metadata.sourceTitle ?? "Resume",
    excerpt: chunk.text.slice(0, 140)
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
    education: educationBlocks.map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      return {
        school: lines[0] ?? "Education",
        degree: lines.slice(1).join(" "),
        highlights: [],
        evidenceRefs
      };
    }),
    skills,
    experience: experienceBlocks.map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const bullets = lines
        .filter((line) => line.startsWith("-"))
        .map((line) => line.replace(/^-+\s*/, ""));
      const header = lines.find((line) => !line.startsWith("-")) ?? "Experience";
      const [title, company, date] = header.split("|").map((item) => item?.trim());
      return {
        title: title ?? header,
        company,
        date,
        bullets,
        evidenceRefs
      };
    }),
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

  const result = await generateJson(prompt, () => fallbackResumeParse(text, chunks));
  const candidateProfile = candidateProfileSchema.parse({
    ...result.data,
    evidenceRefs:
      chunks.slice(0, 6).map((chunk) => ({
        sourceId: chunk.sourceId,
        chunkId: chunk.id,
        kind: chunk.kind,
        title: chunk.metadata.sourceTitle ?? "Resume",
        excerpt: chunk.text.slice(0, 160)
      })) ?? []
  });

  return {
    rawText: text,
    candidateProfile,
    evidenceMap: buildEvidenceMap(chunks)
  };
}
