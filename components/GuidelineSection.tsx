
import React, { useState, useEffect } from 'react';
import { BookOpen, ExternalLink, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchGuidelines } from '../services/geminiService';
import { Paper } from '../types';

const GuidelineSection: React.FC = () => {
  const [guidelines, setGuidelines] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadGuidelines = async () => {
    setLoading(true);
    try {
      const data = await fetchGuidelines();
      setGuidelines(data);
    } catch (err) {
      console.error('Error fetching guidelines:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGuidelines();
  }, []);

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      <div className="flex flex-col space-y-1">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tight">최신 가이드라인 소개</h3>
        </div>
        <p className="text-slate-500 text-sm font-medium mt-2">
          지난 1년간 17개 주요 저널에서 출간된 가이드라인 및 합의 성명서(Consensus Statement)를 확인하세요.
        </p>
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-12 h-12 border-4 border-slate-100 border-t-emerald-600 rounded-full animate-spin"></div>
            <p className="text-slate-400 font-bold">PubMed에서 가이드라인을 수집 중입니다...</p>
          </div>
        ) : guidelines.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
            <p className="text-slate-400 font-bold">검색된 가이드라인이 없습니다.</p>
          </div>
        ) : (
          guidelines.map((g) => (
            <div 
              key={g.id} 
              className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 group"
            >
              <div 
                className="p-8 cursor-pointer"
                onClick={() => toggleExpand(g.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-lg uppercase tracking-widest">
                        {g.journal}
                      </span>
                      <div className="flex items-center text-[11px] text-slate-400 font-bold space-x-3">
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {g.date}
                        </span>
                      </div>
                    </div>
                    <h4 className="text-xl md:text-2xl font-black text-slate-900 leading-tight group-hover:text-emerald-600 transition-colors">
                      {g.title}
                    </h4>
                    <div className="text-[11px] text-slate-400 font-bold">
                      {g.authors.slice(0, 3).join(', ')}{g.authors.length > 3 ? ' et al.' : ''}
                    </div>
                  </div>
                  <div className="flex-shrink-0 mt-1">
                    {expandedId === g.id ? (
                      <ChevronUp className="w-6 h-6 text-slate-300" />
                    ) : (
                      <ChevronDown className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                </div>
              </div>

              {expandedId === g.id && (
                <div className="px-8 pb-8 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="pt-6 border-t border-slate-100 space-y-6">
                    <a 
                      href={g.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 text-sm font-black text-blue-600 hover:text-blue-700 bg-blue-50 px-4 py-2 rounded-xl transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>원본 논문 보기 (PubMed)</span>
                    </a>
                    
                    <div className="prose prose-slate max-w-none">
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                        {g.abstract || g.summary}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default GuidelineSection;
