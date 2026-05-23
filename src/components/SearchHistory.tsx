import { Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SearchHistoryEntry } from '@/hooks/useSearchHistory';

interface SearchHistoryProps<P> {
  entries: SearchHistoryEntry<P>[];
  onApply: (entry: SearchHistoryEntry<P>) => void;
  onRemove?: (id: string) => void;
  onClear?: () => void;
  /** Section heading. Defaults to "Recent searches". */
  title?: string;
  className?: string;
}

function formatRelative(ts: number): string {
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return 'just now';
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function SearchHistory<P>({
  entries,
  onApply,
  onRemove,
  onClear,
  title = 'Recent searches',
  className,
}: SearchHistoryProps<P>) {
  if (entries.length === 0) return null;

  return (
    <div
      className={`flex flex-col gap-2 ${className ?? ''}`}
      data-testid="search-history"
      aria-label={title}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          <Clock className="h-3 w-3" />
          {title}
        </div>
        {onClear && entries.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="group inline-flex items-stretch rounded-full border border-border/60 bg-background/60 text-xs hover:border-border hover:bg-background transition-colors"
          >
            <button
              type="button"
              onClick={() => onApply(entry)}
              className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 max-w-[20rem] text-left"
              title={`Run again — ${entry.label} (${formatRelative(entry.timestamp)})`}
            >
              <span className="truncate font-medium">{entry.label}</span>
              <span className="text-muted-foreground shrink-0">
                {formatRelative(entry.timestamp)}
              </span>
              {typeof entry.resultCount === 'number' && (
                <span className="text-muted-foreground shrink-0">
                  · {entry.resultCount}
                </span>
              )}
            </button>
            {onRemove && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(entry.id);
                }}
                aria-label={`Remove ${entry.label} from history`}
                className="h-auto w-7 px-0 rounded-l-none rounded-r-full opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
