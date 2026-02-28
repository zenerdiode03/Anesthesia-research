
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col selection:bg-blue-100 selection:text-blue-900">
      <header className="sticky top-0 z-50 glass-effect">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-700 to-slate-900 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg transform rotate-3">
                AH
              </div>
              <div className="leading-tight">
                <h1 className="text-lg font-black text-slate-900 tracking-tight">
                  마취<span className="text-blue-600">사냥꾼</span>
                </h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden sm:block">
                  Anesthesia Hunter
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden lg:flex flex-col items-end mr-2">
                <span className="text-[10px] font-black text-green-600 uppercase tracking-tighter">Live from PubMed</span>
                <span className="text-[9px] text-slate-400 font-medium">Updated every 24h</span>
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
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white font-bold text-sm uppercase">
                AH
              </div>
              <h3 className="text-white font-black tracking-tight">마취사냥꾼 (Anesthesia Hunter)</h3>
            </div>
            <p className="text-sm leading-relaxed max-w-sm">
              대한민국 마취통증의학 연구자들이 최신 의학 지식을 더 빠르고 효율적으로 사냥하듯 습득할 수 있도록 돕는 AI 기반 학술 큐레이션 서비스입니다.
            </p>
          </div>
          
          <div className="text-right flex flex-col justify-end space-y-4">
            <div className="space-x-6 text-sm font-bold">
              <a href="#" className="hover:text-white transition-colors">원천 데이터(NCBI)</a>
            </div>
            <div className="text-xs space-y-1">
              <p>© {new Date().getFullYear()} 마취사냥꾼. All rights reserved.</p>
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
