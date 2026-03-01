
import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Send, ExternalLink, Eye, Clock, Lock, ChevronDown, ChevronUp } from 'lucide-react';

interface Guideline {
  id: string;
  title: string;
  link: string;
  content: string;
  views: number;
  date: string;
}

const GuidelineSection: React.FC = () => {
  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [password, setPassword] = useState('');
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [content, setContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const fetchGuidelines = async () => {
    try {
      const res = await fetch('/api/guidelines');
      const data = await res.json();
      setGuidelines(data);
    } catch (err) {
      console.error('Error fetching guidelines:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuidelines();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);

    try {
      const res = await fetch('/api/guidelines/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, title, link, content }),
      });

      if (res.ok) {
        setPassword('');
        setTitle('');
        setLink('');
        setContent('');
        setShowUpload(false);
        fetchGuidelines();
      } else {
        const errText = await res.text();
        alert(errText || '업로드 실패');
      }
    } catch (err) {
      alert('업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  const incrementView = async (id: string) => {
    try {
      await fetch(`/api/guidelines/${id}/view`, { method: 'POST' });
      setGuidelines(prev => prev.map(g => g.id === id ? { ...g, views: (g.views || 0) + 1 } : g));
    } catch (err) {
      console.error('Error incrementing view:', err);
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      incrementView(id);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col space-y-1">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">최신 가이드라인 소개</h3>
          </div>
          <p className="text-slate-500 text-sm font-medium mt-2">마취통증의학 분야의 최신 임상 가이드라인과 보고서를 확인하세요.</p>
        </div>
        
        <button 
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center space-x-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
        >
          <Plus className="w-4 h-4" />
          <span>가이드라인 등록</span>
        </button>
      </div>

      {showUpload && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 md:p-10 shadow-xl animate-in zoom-in-95 duration-300">
          <div className="flex items-center space-x-3 mb-8">
            <Lock className="w-5 h-5 text-slate-400" />
            <h4 className="text-xl font-black text-slate-900">관리자 업로드</h4>
          </div>
          
          <form onSubmit={handleUpload} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Admin Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                  placeholder="관리자 비밀번호"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Title</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                  placeholder="가이드라인 제목"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Paper Link (Optional)</label>
              <input 
                type="url" 
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Content</label>
              <textarea 
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium min-h-[200px]"
                placeholder="가이드라인 주요 내용 (Markdown 지원 예정)"
                required
              />
            </div>

            <button 
              type="submit"
              disabled={isUploading}
              className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all flex items-center justify-center space-x-3 disabled:opacity-50 shadow-lg shadow-emerald-100"
            >
              {isUploading ? (
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>업로드 완료</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      <div className="space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-12 h-12 border-4 border-slate-100 border-t-emerald-600 rounded-full animate-spin"></div>
            <p className="text-slate-400 font-bold">가이드라인을 불러오는 중...</p>
          </div>
        ) : guidelines.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
            <p className="text-slate-400 font-bold">등록된 가이드라인이 없습니다.</p>
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
                        Guideline
                      </span>
                      <div className="flex items-center text-[11px] text-slate-400 font-bold space-x-3">
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(g.date).toLocaleDateString()}
                        </span>
                        <span className="flex items-center">
                          <Eye className="w-3 h-3 mr-1" />
                          {g.views || 0} views
                        </span>
                      </div>
                    </div>
                    <h4 className="text-xl md:text-2xl font-black text-slate-900 leading-tight group-hover:text-emerald-600 transition-colors">
                      {g.title}
                    </h4>
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
                    {g.link && (
                      <a 
                        href={g.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-2 text-sm font-black text-blue-600 hover:text-blue-700 bg-blue-50 px-4 py-2 rounded-xl transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>원본 논문/보고서 보기</span>
                      </a>
                    )}
                    
                    <div className="prose prose-slate max-w-none">
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                        {g.content}
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
