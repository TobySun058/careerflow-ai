import { readFile } from "fs/promises";
import path from "path";

import { getEnv } from "@/lib/config";
import { ResumakeMcpClient } from "@/lib/mcp/resumake/client";
import type { ResumakeResumeData } from "@/lib/mcp/resumake/types";
import type { SessionRecord } from "@/lib/schemas";
import { getActiveResumeSource } from "@/lib/tools/session-state";
import { slugify } from "@/lib/utils";

function extractContactBasics(text: string, fallbackName: string) {
  const normalized = text.replace(/\r/g, "");
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const email = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone =
    normalized.match(/(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/)?.[0];
  const website =
    normalized.match(/https?:\/\/\S+|www\.\S+|linkedin\.com\/\S+|github\.com\/\S+/i)?.[0];
  const nameLine = lines[0] && !lines[0].includes("@") ? lines[0] : fallbackName;

  return {
    name: nameLine || fallbackName,
    email,
    phone,
    website
  };
}

function buildResumakeResumeData(session: SessionRecord): ResumakeResumeData {
  const profile = session.parsedResumeProfile;
  const activeResume = getActiveResumeSource(session);
  const basics = extractContactBasics(activeResume?.content ?? "", profile?.name ?? "Candidate");

  return {
    selectedTemplate: getEnv().resumakeTemplateNumber,
    basics: {
      name: basics.name,
      email: basics.email,
      phone: basics.phone,
      website: basics.website
    },
    work: (profile?.experience ?? []).map((item) => ({
      company: item.company ?? "Experience",
      position: item.title,
      endDate: item.date,
      highlights: item.bullets
    })),
    education: (profile?.education ?? []).map((item) => ({
      institution: item.school,
      studyType: item.degree,
      endDate: item.date,
      courses: item.highlights
    })),
    skills: profile?.skills.length
      ? [
          {
            name: "Skills",
            keywords: profile.skills
          }
        ]
      : [],
    projects: (profile?.projects ?? []).map((item) => ({
      name: item.name,
      description: item.description.join("; "),
      keywords: item.technologies
    }))
  };
}

function buildResumakeFilename(session: SessionRecord) {
  const profile = session.parsedResumeProfile;
  const job = session.selectedOpportunityProfile;
  const name = slugify(profile?.name ?? session.title ?? "careerflow-resume") || "careerflow-resume";
  const role = slugify(job?.title ?? "resume") || "resume";
  return `${name}-${role}`;
}

function buildResumakeFolderPath(session: SessionRecord) {
  const company = slugify(session.selectedOpportunityProfile?.company ?? "general");
  return `careerflow/${company}`;
}

export function exportArtifacts(
  session: SessionRecord,
  format: "json" | "markdown" | "pdf" = "markdown"
) {
  if (format === "json") {
    return {
      filename: `${session.id}-careerflow.json`,
      mimeType: "application/json",
      content: JSON.stringify(session, null, 2)
    };
  }

  if (format === "pdf") {
    throw new Error("PDF export requires the async exportArtifactsAsync helper.");
  }

  const content = [
    "# CareerFlow AI Export",
    "",
    `Session: ${session.id}`,
    `Updated: ${session.updatedAt}`,
    "",
    ...session.artifacts.flatMap((artifact) => [
      `## ${artifact.title}`,
      "",
      artifact.content,
      ""
    ])
  ].join("\n");

  return {
    filename: `${session.id}-careerflow.md`,
    mimeType: "text/markdown",
    content
  };
}

export async function exportArtifactsAsync(
  session: SessionRecord,
  format: "json" | "markdown" | "pdf" = "markdown"
) {
  if (format !== "pdf") {
    return exportArtifacts(session, format);
  }

  const resumake = new ResumakeMcpClient();
  if (!resumake.isConfigured()) {
    return exportArtifacts(session, "markdown");
  }

  try {
    const generated = await resumake.generateResume({
      resumeData: buildResumakeResumeData(session),
      filename: buildResumakeFilename(session),
      folderPath: buildResumakeFolderPath(session)
    });

    if (generated.filePath) {
      const resolvedPath = path.isAbsolute(generated.filePath)
        ? generated.filePath
        : path.resolve(generated.filePath);
      const pdf = await readFile(resolvedPath);
      return {
        filename: generated.filename ?? path.basename(resolvedPath),
        mimeType: "application/pdf",
        content: pdf.toString("base64"),
        encoding: "base64" as const
      };
    }

    return {
      filename: `${buildResumakeFilename(session)}-resumake.txt`,
      mimeType: "text/plain",
      content:
        generated.summary ??
        "Resumake MCP ran, but no readable PDF path was returned. Check the resumake output folder."
    };
  } catch {
    return exportArtifacts(session, "markdown");
  }
}
