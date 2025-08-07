import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Brain, Target, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LeadScoreBadgeProps {
  leadId: string;
  className?: string;
  showIcon?: boolean;
}

export function LeadScoreBadge({ leadId, className = "", showIcon = true }: LeadScoreBadgeProps) {
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadScore = async () => {
      try {
        const { data } = await supabase
          .from('lead_scoring')
          .select('overall_score')
          .eq('lead_id', leadId)
          .single();

        if (data) {
          setScore(data.overall_score);
        }
      } catch (error) {
        console.error('Error loading lead score:', error);
      } finally {
        setLoading(false);
      }
    };

    if (leadId) {
      loadScore();
    }
  }, [leadId]);

  const getPriorityInfo = (score: number) => {
    if (score >= 700) return { 
      level: 'HOT', 
      variant: 'destructive' as const, 
      icon: AlertTriangle, 
      color: 'text-red-500' 
    };
    if (score >= 500) return { 
      level: 'WARM', 
      variant: 'default' as const, 
      icon: Target, 
      color: 'text-yellow-500' 
    };
    if (score >= 300) return { 
      level: 'COLD', 
      variant: 'secondary' as const, 
      icon: CheckCircle, 
      color: 'text-blue-500' 
    };
    return { 
      level: 'LOW', 
      variant: 'outline' as const, 
      icon: CheckCircle, 
      color: 'text-gray-500' 
    };
  };

  if (loading) {
    return (
      <Badge variant="outline" className={`${className} animate-pulse`}>
        {showIcon && <Brain className="h-3 w-3 mr-1" />}
        Analyzing...
      </Badge>
    );
  }

  if (score === null) {
    return null; // Don't show badge if no score available
  }

  const priority = getPriorityInfo(score);
  const Icon = priority.icon;

  return (
    <Badge variant={priority.variant} className={className}>
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      {priority.level} ({score})
    </Badge>
  );
}