import { DashboardNav } from '@/components/DashboardNav';
import { PropertyAlertsManager } from '@/components/PropertyAlertsManager';
import { ChatAssistant } from '@/components/ChatAssistant';

export default function Alerts() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <DashboardNav />
      <main className="container mx-auto mobile-padding pt-24 pb-16 space-y-10">
        <section className="text-center space-y-4 max-w-2xl mx-auto animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight">Property Alerts</h1>
          <p className="text-lg text-muted-foreground font-light leading-relaxed">
            Get notified when new +$30K spread deals appear in your target markets
          </p>
        </section>
        <section className="max-w-4xl mx-auto animate-fade-in">
          <PropertyAlertsManager />
        </section>
      </main>
      <ChatAssistant />
    </div>
  );
}
