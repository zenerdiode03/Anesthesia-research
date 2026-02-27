
import { JournalInfo, JournalName } from './types';

export const JOURNALS: Record<JournalName, JournalInfo> = {
  'Anesthesiology': {
    name: 'Anesthesiology',
    shortName: 'Anesthesiology',
    color: '#1e3a8a'
  },
  'British Journal of Anaesthesia': {
    name: 'British Journal of Anaesthesia',
    shortName: 'BJA',
    color: '#1e40af'
  },
  'Anaesthesia': {
    name: 'Anaesthesia',
    shortName: 'Anaesthesia',
    color: '#1d4ed8'
  },
  'Anesthesia & Analgesia': {
    name: 'Anesthesia & Analgesia',
    shortName: 'A&A',
    color: '#2563eb'
  },
  'European Journal of Anaesthesiology': {
    name: 'European Journal of Anaesthesiology',
    shortName: 'EJA',
    color: '#3b82f6'
  },
  'Regional Anesthesia & Pain Medicine': {
    name: 'Regional Anesthesia & Pain Medicine',
    shortName: 'RAPM',
    color: '#60a5fa'
  },
  'Canadian Journal of Anesthesia': {
    name: 'Canadian Journal of Anesthesia',
    shortName: 'CJA',
    color: '#ef4444'
  },
  'Journal of Clinical Anesthesia': {
    name: 'Journal of Clinical Anesthesia',
    shortName: 'JCA',
    color: '#8b5cf6'
  },
  'Korean Journal of Anesthesiology': {
    name: 'Korean Journal of Anesthesiology',
    shortName: 'KJA',
    color: '#059669'
  },
  'Journal of Anesthesia': {
    name: 'Journal of Anesthesia',
    shortName: 'J Anesth',
    color: '#0891b2'
  },
  'Pain': {
    name: 'Pain',
    shortName: 'Pain',
    color: '#f97316'
  }
};

export const CATEGORIES = [
  'Clinical Trial',
  'Review',
  'Case Report',
  'Meta-Analysis',
  'Observational'
] as const;
