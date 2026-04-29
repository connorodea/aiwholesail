import { Badge } from '@/components/ui/badge';
import { SequenceStatus } from '@/types/sequences';

const STATUS_CONFIG: Record<SequenceStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-500/10 text-green-600 border-green-500/30' },
  paused: { label: 'Paused', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  completed: { label: 'Completed', className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground border-border' },
};

interface SequenceStatusBadgeProps {
  status: SequenceStatus;
}

export function SequenceStatusBadge({ status }: SequenceStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  return (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      {config.label}
    </Badge>
  );
}
