export type DiceSearchFilters = {
  location?: string;
  remote?: boolean;
  employmentType?: string;
  limit?: number;
};

export type DiceJobDetails = {
  id: string;
  title: string;
  company: string;
  location: string;
  summary: string;
  url?: string;
  description?: string;
  keywords: string[];
  provider: string;
};
