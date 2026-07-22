export const THEMES = [
  "Automatización y electrónica",
  "Software y datos",
  "Diseño y manufactura",
  "Mantenimiento y operaciones",
  "Gestión y calidad",
  "Sostenibilidad",
  "Otros",
] as const;

export type Theme = (typeof THEMES)[number];

export interface PlacementRecord {
  id: string;
  semester: string;
  semesterOrder: number;
  company: string;
  companyKey: string;
  city: string;
  department: string;
  startDate: string | null;
  endDate: string | null;
  durationDays: number | null;
  theme: Theme;
  visitsCompleted: number;
  reportedPlaced: number | null;
  reportedUnplaced: number | null;
}

export interface FallbackPayload {
  generatedAt: string;
  records: Omit<PlacementRecord, "id" | "companyKey" | "semesterOrder">[];
}

export interface LoadedDataset {
  records: PlacementRecord[];
  source: "Google Sheets" | "respaldo local";
  loadedAt: Date;
  warning?: string;
}

export interface FilterState {
  semester: string;
  companyKey: string;
  theme: string;
  city: string;
  department: string;
}

export interface DataQuality {
  missingStart: number;
  missingEnd: number;
  invalidDuration: number;
  reportedMismatch: number;
  completeness: number;
}

export interface DashboardMetrics {
  placements: number;
  companies: number;
  medianDuration: number | null;
  placementRate: number | null;
  semesterTrend: Array<{ semester: string; count: number; movingAverage: number }>;
  topCompanies: Array<{ key: string; name: string; count: number; semesters: number }>;
  themeCounts: Array<{ name: Theme; value: number }>;
  organizationContinuity: Array<{ semester: string; newOrganizations: number; recurringOrganizations: number }>;
  geographyCounts: Array<{ name: string; value: number; city: string }>;
  quality: DataQuality;
  insights: string[];
}
