export const THEMES = [
  "Automatización y control",
  "Software y transformación digital",
  "Diseño y desarrollo de producto",
  "Mantenimiento y confiabilidad",
  "Operaciones y logística",
  "Gestión, calidad y seguridad",
  "Energía y sostenibilidad",
  "Salud y tecnología biomédica",
  "Educación e innovación",
  "Ingeniería y soporte técnico",
  "Sin información / por definir",
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
  sector: string;
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

export interface DirectoryRecord {
  id: string;
  studentName: string;
  semester: string;
  company: string;
  projectTitle: string;
  tutorName: string;
  city: string;
  department: string;
  sector: string;
  theme: Theme;
}

export interface DirectoryPayload {
  generatedAt: string;
  records: DirectoryRecord[];
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
  sector: string;
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
  averageDuration: number | null;
  placementRate: number | null;
  semesterTrend: Array<{ semester: string; count: number }>;
  topCompanies: Array<{ key: string; name: string; count: number; semesters: number }>;
  themeCounts: Array<{ name: Theme; value: number }>;
  sectorCounts: Array<{ name: string; value: number }>;
  organizationContinuity: Array<{ semester: string; newOrganizations: number; recurringOrganizations: number }>;
  geographyCounts: Array<{ name: string; value: number; city: string }>;
  quality: DataQuality;
  insights: string[];
}
