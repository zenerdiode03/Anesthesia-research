
export interface Paper {
  id: string;
  title: string;
  authors: string[];
  journal: JournalName;
  date: string;
  doi?: string;
  abstract?: string;
  summary?: string;
  clinicalImpact?: string;
  category: 'Review' | 'Original Article';
  url: string;
  tags: string[];
  keywords?: string[];
}

export type JournalName = 
  | 'Anesthesiology'
  | 'British Journal of Anaesthesia'
  | 'Anaesthesia'
  | 'Anesthesia & Analgesia'
  | 'European Journal of Anaesthesiology'
  | 'Regional Anesthesia & Pain Medicine'
  | 'Canadian Journal of Anesthesia'
  | 'Journal of Clinical Anesthesia'
  | 'Korean Journal of Anesthesiology'
  | 'Journal of Anesthesia'
  | 'Pain';

export interface JournalInfo {
  name: JournalName;
  shortName: string;
  color: string;
}

export interface ResearchStats {
  totalPapers: number;
  byCategory: { name: string; value: number }[];
  byJournal: { name: string; value: number }[];
}
