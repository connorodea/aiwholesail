import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UpgradePromptProps {
  featureName: string;
  description?: string;
}

/**
 * UpgradePrompt — shown when a Pro/trial user tries to access an Elite-only feature.
 * Dark themed with cyan accent to match the AIWholesail design system.
 */
export function UpgradePrompt({ featureName, description }: UpgradePromptProps) {
  const navigate = useNavigate();

  return (
    <Card className="border-2 border-dashed border-cyan-500/30 bg-gradient-to-br from-[#0a0b0d] via-[#0d1117] to-cyan-950/20 rounded-2xl shadow-lg">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center px-6">
        <div className="relative mb-6">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 shadow-inner">
            <Lock className="h-10 w-10 text-cyan-400" />
          </div>
          <div className="absolute -top-1 -right-1 p-1.5 rounded-full bg-cyan-500/20 border border-cyan-500/30">
            <Zap className="h-3.5 w-3.5 text-cyan-400" />
          </div>
        </div>

        <h3 className="text-2xl font-semibold mb-3 text-white">
          {featureName}
        </h3>

        <p className="text-neutral-400 mb-2 max-w-md leading-relaxed">
          {description ||
            'This feature is available exclusively on the Elite plan.'}
        </p>

        <p className="text-sm text-neutral-500 mb-8 max-w-sm">
          Unlock AI-powered analysis, photo condition assessment, ARV/comps,
          skip tracing, lead scoring, and unlimited searches.
        </p>

        <Button
          onClick={() => navigate('/pricing')}
          size="lg"
          className="gap-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-8 py-3 font-semibold"
        >
          <Zap className="h-5 w-5" />
          Upgrade to Elite — $99/mo
        </Button>

        <p className="text-xs text-neutral-600 mt-4">
          7-day free trial included with all new subscriptions
        </p>
      </CardContent>
    </Card>
  );
}
