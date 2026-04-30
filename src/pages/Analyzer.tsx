import { DashboardNav } from '@/components/DashboardNav';
import { AIWholesaleAnalyzer } from '@/components/AIWholesaleAnalyzer';
import { ChatAssistant } from '@/components/ChatAssistant';

export default function Analyzer() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <DashboardNav />
      <main className="container mx-auto mobile-padding pt-24 pb-16 space-y-10">
        <section className="text-center space-y-4 max-w-2xl mx-auto animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight">AI Deal Analyzer</h1>
          <p className="text-lg text-muted-foreground font-light leading-relaxed">
            AI-powered analysis to rank and score investment opportunities
          </p>
        </section>
        <section className="max-w-6xl mx-auto animate-fade-in">
          <AIWholesaleAnalyzer properties={[]} market="" />
        </section>
      </main>
      <ChatAssistant />
    </div>
  );
}
