import { Helmet } from 'react-helmet-async';
import { Calendar } from 'lucide-react';

const LAST_UPDATED = '2026-05-12';

interface HowToStep {
  name: string;
  text: string;
}

interface FAQ {
  q: string;
  a: string;
}

interface CalculatorSchemaProps {
  slug: string;
  name: string;
  /** 40-60 word AI-extractable answer block. */
  summary: string;
  /** Step-by-step instructions for the HowTo schema + visible callout. */
  steps: HowToStep[];
  /** Question/answer items rendered as FAQPage schema + visible UI. */
  faqs: FAQ[];
  /** Total estimated time as ISO 8601 duration. Defaults to PT2M. */
  totalTime?: string;
  /** Whether to show the visible "How to use" + FAQ sections below the calculator. */
  showVisible?: boolean;
}

/**
 * Drops Article + HowTo + FAQPage + SoftwareApplication JSON-LD onto a
 * calculator page, plus an optional visible answer block, How-to list, and
 * FAQ section. Keeps each /tools/[slug] page consistent without 14 separate
 * schema implementations.
 */
export function CalculatorSchema({
  slug,
  name,
  summary,
  steps,
  faqs,
  totalTime = 'PT2M',
  showVisible = true,
}: CalculatorSchemaProps) {
  const canonical = `https://aiwholesail.com/tools/${slug}`;

  const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `How to use the ${name}`,
    description: summary,
    totalTime,
    tool: { '@type': 'HowToTool', name },
    step: steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
      url: `${canonical}#step-${i + 1}`,
    })),
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: name,
    description: summary,
    url: canonical,
    author: { '@type': 'Organization', name: 'AIWholesail', url: 'https://aiwholesail.com' },
    publisher: {
      '@type': 'Organization',
      name: 'AIWholesail',
      logo: { '@type': 'ImageObject', url: 'https://aiwholesail.com/logo-aiw.png' },
    },
    datePublished: LAST_UPDATED,
    dateModified: LAST_UPDATED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
  };

  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    url: canonical,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    creator: { '@type': 'Organization', name: 'AIWholesail', url: 'https://aiwholesail.com' },
    isPartOf: { '@type': 'WebSite', name: 'AIWholesail', url: 'https://aiwholesail.com' },
  };

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(articleJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(howToJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(softwareJsonLd)}</script>
        <meta name="last-modified" content={LAST_UPDATED} />
        <meta property="article:modified_time" content={LAST_UPDATED} />
      </Helmet>

      {showVisible && (
        <>
          {/* AI-extractable answer block */}
          <section className="py-10 px-4">
            <div className="container mx-auto max-w-3xl">
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <h2 className="text-sm font-semibold tracking-[0.15em] uppercase text-cyan-400">
                    What does the {name.toLowerCase()} do?
                  </h2>
                  <span className="inline-flex items-center gap-2 text-xs text-white/40">
                    <Calendar className="h-3 w-3" /> Updated <time dateTime={LAST_UPDATED}>{LAST_UPDATED}</time>
                  </span>
                </div>
                <p className="text-base md:text-lg text-white/80 font-light leading-relaxed">{summary}</p>
              </div>
            </div>
          </section>

          {/* How-to steps */}
          <section className="py-12 px-4">
            <div className="container mx-auto max-w-3xl">
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">How to use</p>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-8">
                Step-by-step.
              </h2>
              <ol className="space-y-4">
                {steps.map((s, i) => (
                  <li
                    key={i}
                    id={`step-${i + 1}`}
                    className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 flex gap-4"
                  >
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-sm font-semibold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="text-base md:text-lg font-semibold text-white mb-1.5">{s.name}</h3>
                      <p className="text-sm md:text-base text-white/70 font-light leading-relaxed">{s.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* FAQ */}
          <section className="py-12 px-4">
            <div className="container mx-auto max-w-3xl">
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">FAQ</p>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-8">
                Common questions.
              </h2>
              <div className="space-y-4">
                {faqs.map((f, i) => (
                  <div
                    key={i}
                    className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6"
                  >
                    <h3 className="text-base md:text-lg font-semibold text-white mb-2">{f.q}</h3>
                    <p className="text-sm md:text-base text-white/70 font-light leading-relaxed">{f.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
