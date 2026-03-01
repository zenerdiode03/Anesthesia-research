
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

export interface Podcast {
  id: string;
  title: string;
  description: string;
  audioUrl: string;
  date: string;
  duration?: string;
}

export type JournalName = 
  | 'Anaesthesia'
  | 'Anaesthesia Critical Care and Pain Medicine'
  | 'Anesthesia & Analgesia'
  | 'Anesthesiology'
  | 'BJA Education'
  | 'British Journal of Anaesthesia'
  | 'Canadian Journal of Anesthesia'
  | 'European Journal of Anaesthesiology'
  | 'Journal of Anesthesia'
  | 'Journal of Cardiothoracic and Vascular Anesthesia'
  | 'Journal of Clinical Anesthesia'
  | 'Journal of Neurosurgical Anesthesiology'
  | 'Korean Journal of Anesthesiology'
  | 'Korean Journal of Pain'
  | 'Paediatric Anaesthesia'
  | 'Pain'
  | 'Regional Anesthesia & Pain Medicine';

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
