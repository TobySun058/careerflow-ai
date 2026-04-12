import demoData from "@/data/sample/demo.json";
import { makeId } from "@/lib/utils";

import type { JobDiscoveryProvider, JobSearchFilters } from "./interface";

export class ManualJobDiscoveryProvider implements JobDiscoveryProvider {
  async searchJobs(query: string, _filters?: JobSearchFilters) {
    const keywords = query
      .split(/\s+/)
      .map((token) => token.toLowerCase())
      .filter(Boolean);

    return [
      {
        id: makeId("job"),
        title: "Applied AI Product Engineering Intern",
        company: "BrightPath Careers",
        location: "Remote",
        summary: demoData.jobDescription.slice(0, 240),
        url: demoData.jobUrl,
        keywords: ["TypeScript", "Next.js", "RAG", "Product", "AI"],
        sourceRefs: []
      },
      {
        id: makeId("job"),
        title: "Career Platform Engineer Intern",
        company: "LaunchLayer",
        location: "Chicago, IL",
        summary:
          "Build grounded job-search and resume-tailoring workflows for student users.",
        url: "https://example.com/jobs/career-platform-engineer-intern",
        keywords: ["React", "LLMs", "Grounding", "Analytics", ...keywords.slice(0, 2)],
        sourceRefs: []
      },
      {
        id: makeId("job"),
        title: "AI Workflow Product Intern",
        company: "SignalSpring",
        location: "Hybrid",
        summary:
          "Prototype product experiences that combine retrieval, workflow orchestration, and strong UX.",
        url: "https://example.com/jobs/ai-workflow-product-intern",
        keywords: ["Next.js", "Product", "Evaluation", ...keywords.slice(0, 2)],
        sourceRefs: []
      }
    ];
  }

  async getJobById(id: string) {
    const jobs = await this.searchJobs("career ai");
    return jobs.find((job) => job.id === id) ?? null;
  }
}
