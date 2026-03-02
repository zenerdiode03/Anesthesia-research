
import React, { useState } from 'react';
import { Paper } from '../types';
import { JOURNALS } from '../constants';

interface PaperCardProps {
  paper: Paper;
}

const PaperCard: React.FC<PaperCardProps> = ({ paper }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const journalInfo = JOURNALS[paper.journal as keyof typeof JOURNALS] || { color: '#64748b', shortName: paper.journal };

  // Map category to user-friendly labels
  const getCategoryLabel = (cat: string) => {
    if (cat === 'Review') return 'Review';
    return 'Original Article';
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col h-full group">
      <div className="p-6 flex-grow">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span 
              className="px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: journalInfo.color }}
            >
              {journalInfo.shortName}
            </span>
            <span className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider ${paper.category === 'Review' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {getCategoryLabel(paper.category)}
            </span>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {paper.date}
          </span>
        </div>

        <a 
          href={paper.url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="block mb-3 group/title outline-none"
        >
          <h3 className="text-lg font-bold text-slate-900 leading-snug group-hover/title:text-blue-600 transition-colors">
            <span className="border-b-2 border-transparent group-hover/title:border-blue-100">
                {paper.title}
            </span>
            <svg className="inline-block w-4 h-4 ml-2 mb-1 opacity-20 group-hover/title:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </h3>
        </a>
        
        <p className="text-sm text-slate-500 mb-3 line-clamp-1 font-medium italic">
          {paper.authors?.join(', ')}
        </p>

        {paper.tags && paper.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {paper.tags.map(tag => (
              <span key={tag} className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase tracking-tighter">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {paper.keywords && paper.keywords.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {paper.keywords.map(keyword => (
              <span key={keyword} className="text-xs font-medium text-blue-500 bg-blue-50/50 px-3 py-1 rounded-full">
                {keyword}
              </span>
            ))}
          </div>
        )}

        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Abstract Summary</h4>
            <p className={`text-base text-slate-600 leading-relaxed ${!isExpanded ? 'line-clamp-3' : ''}`}>
              {paper.summary}
            </p>
          </div>

          {isExpanded && paper.clinicalImpact && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1.5 flex items-center">
                <span className="w-2 h-2 bg-blue-600 rounded-full mr-2"></span>
                Clinical Implication
              </h4>
              <p className="text-base text-slate-800 font-bold leading-relaxed border-l-2 border-blue-200 pl-3 py-1">
                {paper.clinicalImpact}
              </p>
              <div className="mt-3 flex items-center text-xs text-slate-400 font-medium bg-slate-100 px-3 py-1 rounded w-fit uppercase">
                Category: {paper.category}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center transition-colors uppercase tracking-widest"
          >
            {isExpanded ? 'Show Less' : 'Full Details'}
            <svg className={`w-4 h-4 ml-1.5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <a 
            href={`https://scholar.google.com/scholar?q=${encodeURIComponent(paper.title)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-slate-400 hover:text-blue-600 flex items-center transition-colors uppercase tracking-widest"
          >
            <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.242 13.769L0.5 9.5 12 0l11.5 9.5-4.742 4.269C17.403 12.739 14.791 12 12 12s-5.403 0.739-6.758 1.769zM12 13a9.927 9.927 0 0 1 6 2v5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-5a9.927 9.927 0 0 1 6-2z" />
            </svg>
            Scholar
          </a>
        </div>
      </div>
    </div>
  );
};

export default PaperCard;
