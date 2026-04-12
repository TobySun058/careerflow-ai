export type JobSpySearchFilters = {
  location?: string;
  remote?: boolean;
  employmentType?: string;
  limit?: number;
  siteNames?: string;
  hoursOld?: number;
  linkedinFetchDescription?: boolean;
  countryIndeed?: string;
};

export type JobSpyJobDetails = {
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
