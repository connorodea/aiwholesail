import { DashboardNav } from '@/components/DashboardNav';
import { ContractManager } from '@/components/contracts/ContractManager';
import { ChatAssistant } from '@/components/ChatAssistant';

export default function Contracts() {
  return (
    <div className="min-h-screen bg-[#08090a] text-white font-sans">
      <DashboardNav />
      <main className="container mx-auto mobile-padding pt-24 pb-16 space-y-10">
        <section className="text-center space-y-4 max-w-2xl mx-auto animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-white">Contract Generator</h1>
          <p className="text-lg text-neutral-400 font-light leading-relaxed">
            Generate real estate contracts, purchase agreements, and letters of intent
          </p>
        </section>
        <section className="max-w-5xl mx-auto animate-fade-in">
          <ContractManager />
        </section>
      </main>
      <ChatAssistant />
    </div>
  );
}
