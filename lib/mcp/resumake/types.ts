export type ResumakeResumeData = {
  selectedTemplate: number;
  basics: {
    name: string;
    email?: string;
    phone?: string;
    website?: string;
    location?: {
      address?: string;
    };
  };
  work: Array<{
    company: string;
    position: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    highlights: string[];
  }>;
  education: Array<{
    institution: string;
    area?: string;
    studyType?: string;
    startDate?: string;
    endDate?: string;
    location?: string;
    courses?: string[];
  }>;
  skills: Array<{
    name: string;
    keywords: string[];
  }>;
  projects: Array<{
    name: string;
    description?: string;
    url?: string;
    keywords?: string[];
  }>;
};

export type ResumakeGenerateResult = {
  filePath?: string;
  filename?: string;
  summary?: string;
  raw?: unknown;
};
