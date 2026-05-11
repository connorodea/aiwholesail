import { useState } from "react";
import type { CitationData } from "@/lib/agent-stream";
import { citationUrl } from "@/lib/agent-stream";

interface Props {
  index: number; // 1-based superscript label
  citation: CitationData;
}

/**
 * Inline citation chip rendered after a cited claim.
 * Click → opens the source URL (e.g. the Zillow detail page) in a new tab.
 * Hover → tooltip with the cited text + title.
 */
export function CitationChip({ index, citation }: Props) {
  const [hover, setHover] = useState(false);
  const url = citationUrl(citation);
  const title = citation.title || citation.document_title || "Source";
  const snippet = (citation.cited_text || "").slice(0, 200);

  const inner = (
    <sup
      className="inline-flex items-center justify-center px-1.5 py-0.5 ml-0.5 rounded-md text-[10px] font-medium leading-none bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 hover:text-cyan-200 transition-colors cursor-pointer"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {index}
    </sup>
  );

  return (
    <span className="relative">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          {inner}
        </a>
      ) : (
        inner
      )}

      {hover && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 w-72 max-w-[90vw] rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 shadow-xl pointer-events-none">
          <span className="block font-medium text-cyan-300 mb-1 truncate">{title}</span>
          {snippet && (
            <span className="block text-neutral-400 line-clamp-3">{snippet}</span>
          )}
          {url && (
            <span className="block text-neutral-500 mt-1 truncate">{url}</span>
          )}
        </span>
      )}
    </span>
  );
}
