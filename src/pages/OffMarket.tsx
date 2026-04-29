import { DashboardNav } from '@/components/DashboardNav';
import { PropDataPropertySearch } from '@/components/PropDataPropertySearch';
import { PropDataMarketPanel } from '@/components/PropDataMarketPanel';
import { ChatAssistant } from '@/components/ChatAssistant';

export default function OffMarket() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <DashboardNav />
      <main className="container mx-auto mobile-padding pt-24 pb-16 space-y-10">
        <section className="text-center space-y-4 max-w-2xl mx-auto animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight">Off-Market Properties</h1>
          <p className="text-lg text-muted-foreground font-light leading-relaxed">
            Discover off-market deals before they hit the MLS
          </p>
        </section>
        <section className="max-w-6xl mx-auto space-y-8 text-left animate-fade-in">
          <PropDataPropertySearch />
          <PropDataMarketPanel />
        </section>
      </main>
      <ChatAssistant />
    </div>
  );
}
