
import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [visitorCount, setVisitorCount] = useState<number | null>(null);

  useEffect(() => {
    const trackVisit = async () => {
      try {
        // Track visit only once per session
        const sessionKey = `visited_${new Date().toISOString().split('T')[0]}`;
        const hasVisited = sessionStorage.getItem(sessionKey);
        
        let endpoint = '/api/stats/visitors';
        let method = 'GET';
        
        if (!hasVisited) {
          endpoint = '/api/stats/visit';
          method = 'POST';
          sessionStorage.setItem(sessionKey, 'true');
        }

        const response = await fetch(endpoint, { method });
        if (response.ok) {
          const data = await response.json();
          setVisitorCount(data.count);
        }
      } catch (error) {
        console.error('Failed to track visit:', error);
      }
    };

    trackVisit();
  }, []);

  return (
    <div className="min-h-screen flex flex-col selection:bg-blue-100 selection:text-blue-900">
      <header className="sticky top-0 z-50 glass-effect">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-lg border border-white/10">
                TRACK
              </div>
              <div className="leading-tight">
                <h1 className="text-lg font-black text-slate-900 tracking-tighter">
                  <span className="text-blue-600">T</span>RACK
                </h1>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em] hidden sm:block">
                  Anesthesiology Research
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              {visitorCount !== null && (
                <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <div className="flex flex-col leading-none">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Today's Visitors</span>
                    <span className="text-sm font-black text-slate-900">{visitorCount.toLocaleString()}</span>
                  </div>
                </div>
              )}
              
              <div className="hidden lg:flex flex-col items-end mr-2">
                <span className="text-xs font-black text-green-600 uppercase tracking-tighter">Live from PubMed</span>
                <span className="text-[10px] text-slate-400 font-medium">Updated every 24h</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        {children}
      </main>

      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center text-white font-black text-[10px] border border-white/10">
                TRACK
              </div>
              <h3 className="text-white font-black tracking-tight">TRACK</h3>
            </div>
            <p className="text-sm leading-relaxed max-w-sm text-slate-500">
              Trends & Research in Anesthesiology Cutting-edge Knowledge. <br/>
              대한민국 마취통증의학 연구자들이 최신 의학 지식을 더 빠르고 효율적으로 습득할 수 있도록 돕는 AI 기반 학술 큐레이션 서비스입니다.
            </p>
          </div>
          
          <div className="text-right flex flex-col justify-end space-y-4">
            <div className="flex items-center justify-end space-x-6 text-xs font-bold">
              <a href="#" className="hover:text-white transition-colors">원천 데이터(NCBI)</a>
            </div>
            <div className="text-xs space-y-1">
              <p>© {new Date().getFullYear()} TRACK. All rights reserved.</p>
              <p className="text-slate-500">
                Developer: 서울대학교병원 마취통증의학과 이호진 (hjpainfree@snu.ac.kr)
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
