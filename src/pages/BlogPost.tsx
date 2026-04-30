import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Clock, Calendar, User, Tag, ArrowRight, Zap,
  ChevronRight, BookOpen, Calculator, Search,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import blogIndex from '@/data/blog/index.json';

interface BlogArticle {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  publishedAt: string;
  readTime: number;
  tags: string[];
  metaDescription?: string;
  metaKeywords?: string;
  sections: Array<{
    type: 'paragraph' | 'heading' | 'subheading' | 'list' | 'cta' | 'quote' | 'tip';
    content?: string;
    items?: string[];
  }>;
}

const categoryColors: Record<string, string> = {
  'Beginner Guide': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Strategy': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'AI & Tech': 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  'Market Insights': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<BlogArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setNotFound(false);

    import(`../data/blog/${slug}.json`)
      .then((mod) => {
        setArticle(mod.default || mod);
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [slug]);

  // Get related articles (same category, excluding current)
  const relatedArticles = (blogIndex.articles || [])
    .filter((a: any) => a.slug !== slug)
    .slice(0, 3);

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center py-40">
          <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      </PublicLayout>
    );
  }

  if (notFound || !article) {
    return (
      <PublicLayout>
        <div className="container mx-auto max-w-3xl pt-32 pb-16 px-4 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">Article Not Found</h1>
          <p className="text-neutral-400 mb-6">The article you're looking for doesn't exist or has been moved.</p>
          <Link to="/blog">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back to Blog
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const publishedDate = new Date(article.publishedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <PublicLayout>
      <SEOHead
        title={article.title}
        description={article.metaDescription || article.excerpt}
        keywords={article.metaKeywords || article.tags.join(', ')}
      />

      {/* ===== HERO HEADER ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <div className="relative container mx-auto max-w-3xl px-4 pt-28 pb-20">
          <div className="flex items-center gap-2 mb-6">
            <Link to="/blog" className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span>Blog</span>
            </Link>
          </div>

          <Badge variant="outline" className={`mb-6 text-xs border ${categoryColors[article.category] || 'border-white/20 text-white/60'}`}>
            {article.category}
          </Badge>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] text-white mb-6">
            {article.title}
          </h1>
          <p className="text-lg text-white/50 font-light leading-relaxed mb-8 max-w-2xl">
            {article.excerpt}
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-white/40">
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> {article.author}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> {publishedDate}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {article.readTime} min read
            </span>
          </div>
        </div>
      </section>

      {/* ===== ARTICLE BODY ===== */}
      <section className="py-16 px-4">
        <article className="container mx-auto max-w-2xl">
          <div className="space-y-7">
            {article.sections.map((section, i) => {
              switch (section.type) {
                case 'heading':
                  return (
                    <h2 key={i} className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-14 mb-2">
                      {section.content}
                    </h2>
                  );
                case 'subheading':
                  return (
                    <h3 key={i} className="text-xl font-bold tracking-tight text-white mt-8 mb-2">
                      {section.content}
                    </h3>
                  );
                case 'paragraph':
                  return (
                    <p key={i} className="text-[17px] text-neutral-400 leading-[1.8] font-light">
                      {section.content}
                    </p>
                  );
                case 'list':
                  return (
                    <ul key={i} className="space-y-3 my-6 ml-1">
                      {section.items?.map((item, j) => (
                        <li key={j} className="flex gap-3 text-[17px] text-neutral-400 leading-[1.8] font-light">
                          <span className="text-cyan-400 mt-1 shrink-0 font-bold">&bull;</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  );
                case 'quote':
                  return (
                    <blockquote key={i} className="my-8 pl-6 border-l-2 border-cyan-500/30 italic text-[17px] text-neutral-400/80 leading-[1.8]">
                      {section.content}
                    </blockquote>
                  );
                case 'tip':
                  return (
                    <div key={i} className="my-8 p-6 border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl">
                      <p className="text-sm font-semibold text-cyan-400 mb-1">Pro Tip</p>
                      <p className="text-[15px] text-neutral-400 leading-relaxed">{section.content}</p>
                    </div>
                  );
                case 'cta':
                  return (
                    <div key={i} className="my-12 p-8 border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl text-center space-y-4">
                      <p className="font-medium leading-relaxed text-white">{section.content}</p>
                      <Link to="/pricing">
                        <button className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-md transition-colors">
                          <Zap className="h-4 w-4" /> Start Free Trial
                        </button>
                      </Link>
                    </div>
                  );
                default:
                  return null;
              }
            })}
          </div>

          {/* Tags */}
          {article.tags.length > 0 && (
            <div className="mt-12 pt-8 border-t border-white/[0.06]">
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="h-4 w-4 text-neutral-400" />
                {article.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs font-light rounded-full border-white/[0.08] text-neutral-400">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Internal Links -- SEO interlinking */}
          <div className="mt-12 p-6 border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-4">Explore More</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <Link to="/tools" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Calculator className="h-4 w-4 text-cyan-400" /> Free Calculators
              </Link>
              <Link to="/how-it-works" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <BookOpen className="h-4 w-4 text-cyan-400" /> How It Works
              </Link>
              <Link to="/use-cases" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Search className="h-4 w-4 text-cyan-400" /> Use Cases
              </Link>
            </div>
          </div>
        </article>

        {/* Related Articles */}
        {relatedArticles.length > 0 && (
          <div className="container mx-auto max-w-5xl mt-20">
            <div className="border-t border-white/[0.06] mb-16" />
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Keep Reading</p>
            <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-8">More articles</h3>
            <div className="grid md:grid-cols-3 gap-4">
              {relatedArticles.map((a: any) => (
                <Link key={a.slug} to={`/blog/${a.slug}`} className="group">
                  <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 hover:shadow-lg transition-all duration-300 h-full flex flex-col">
                    <Badge variant="outline" className={`text-[10px] w-fit mb-3 ${categoryColors[a.category] || ''}`}>
                      {a.category}
                    </Badge>
                    <h4 className="font-bold text-sm text-white mb-2 group-hover:text-cyan-400 transition-colors leading-snug">
                      {a.title}
                    </h4>
                    <p className="text-xs text-neutral-400 font-light line-clamp-2 flex-1">{a.excerpt}</p>
                    <div className="flex items-center gap-1 text-xs font-medium text-cyan-400 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      Read article <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="container mx-auto max-w-3xl mt-20">
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-10 md:p-12 text-center">
            <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-3">
              Find Profitable Deals with AI
            </h3>
            <p className="text-sm text-neutral-400 font-light max-w-md mx-auto mb-6">
              AIWholesail analyzes thousands of properties daily. Get instant deal scoring and market intelligence.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link to="/pricing">
                <button className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-md transition-colors">
                  <Zap className="h-4 w-4" /> Start Free Trial
                </button>
              </Link>
              <Link to="/blog">
                <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
                  <ArrowRight className="h-4 w-4" /> More Articles
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
