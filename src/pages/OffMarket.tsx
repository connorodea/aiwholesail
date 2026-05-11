import { DashboardNav } from '@/components/DashboardNav';
import { AbsenteeOwnerSearch } from '@/components/AbsenteeOwnerSearch';
import { PropDataPropertySearch } from '@/components/PropDataPropertySearch';
import { PropDataMarketPanel } from '@/components/PropDataMarketPanel';
import { ChatAssistant } from '@/components/ChatAssistant';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function OffMarket() {
  return (
    <div className="min-h-screen bg-[#08090a] text-white font-sans">
      <DashboardNav />
      <main className="container mx-auto mobile-padding pt-24 pb-16 space-y-10">
        <section className="text-center space-y-4 max-w-2xl mx-auto animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-white">Off-Market Properties</h1>
          <p className="text-lg text-neutral-400 font-light leading-relaxed">
            Find absentee landlords with equity — the highest-converting direct-mail segment.
          </p>
        </section>
        <section className="max-w-6xl mx-auto space-y-10 text-left animate-fade-in">
          <ErrorBoundary label="AbsenteeOwnerSearch">
            <AbsenteeOwnerSearch />
          </ErrorBoundary>
          <ErrorBoundary label="PropDataPropertySearch">
            <PropDataPropertySearch />
          </ErrorBoundary>
          <ErrorBoundary label="PropDataMarketPanel">
            <PropDataMarketPanel />
          </ErrorBoundary>
        </section>
      </main>
      <ChatAssistant />
    </div>
  );
}
