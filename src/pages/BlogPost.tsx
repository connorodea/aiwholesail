import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, Calendar, User, Tag, ArrowRight, Zap } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';

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
    type: 'paragraph' | 'heading' | 'list' | 'cta';
    content?: string;
    items?: string[];
  }>;
}

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="container mx-auto max-w-3xl pt-32 pb-16 px-4 text-center">
          <h1 className="text-3xl font-medium mb-4">Article Not Found</h1>
          <p className="text-muted-foreground mb-6">The article you're looking for doesn't exist or has been moved.</p>
          <Link to="/blog">
            <Button variant="outline" className="gap-2 rounded-full">
              <ArrowLeft className="h-4 w-4" /> Back to Blog
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const publishedDate = new Date(article.publishedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SEOHead
        title={article.title}
        description={article.metaDescription || article.excerpt}
        keywords={article.metaKeywords || article.tags.join(', ')}
      />

      {/* Header */}
      <header className="fixed top-4 left-4 right-4 z-50">
        <div className="container mx-auto max-w-7xl">
          <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-lg px-6 py-4">
            <div className="flex items-center justify-between">
              <Link to="/blog" className="flex items-center space-x-2 text-sm font-medium hover:text-primary transition-colors">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Blog</span>
              </Link>
              <Link to="/">
                <span className="text-lg font-semibold tracking-tight">AIWholesail</span>
              </Link>
              <div className="w-20" />
            </div>
          </div>
        </div>
      </header>

      {/* Article */}
      <main className="pt-32 pb-16 px-4">
        <article className="container mx-auto max-w-3xl">
          {/* Article Header */}
          <div className="mb-10 space-y-5">
            <Badge variant="secondary" className="text-xs">{article.category}</Badge>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight leading-tight">
              {article.title}
            </h1>
            <p className="text-lg text-muted-foreground font-light leading-relaxed">
              {article.excerpt}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pt-2">
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

          {/* Article Body */}
          <div className="prose-container space-y-6">
            {article.sections.map((section, i) => {
              switch (section.type) {
                case 'heading':
                  return (
                    <h2 key={i} className="text-2xl font-medium tracking-tight mt-10 mb-4">
                      {section.content}
                    </h2>
                  );
                case 'paragraph':
                  return (
                    <p key={i} className="text-muted-foreground leading-relaxed font-light text-base">
                      {section.content}
                    </p>
                  );
                case 'list':
                  return (
                    <ul key={i} className="space-y-3 my-4">
                      {section.items?.map((item, j) => (
                        <li key={j} className="flex gap-3 text-muted-foreground leading-relaxed font-light text-base">
                          <span className="text-primary mt-1.5 shrink-0">-</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  );
                case 'cta':
                  return (
                    <div key={i} className="my-10 p-8 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl text-center space-y-4">
                      <p className="text-foreground font-medium leading-relaxed">{section.content}</p>
                      <Link to="/pricing">
                        <Button className="rounded-full px-6 gap-2">
                          <Zap className="h-4 w-4" /> Start Free Trial
                        </Button>
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
            <div className="mt-10 pt-6 border-t border-border/50">
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="h-4 w-4 text-muted-foreground" />
                {article.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs font-light">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Bottom CTA */}
          <div className="mt-12 p-8 bg-card border border-border/50 rounded-2xl text-center space-y-4">
            <h3 className="text-xl font-medium">Find Profitable Deals with AI</h3>
            <p className="text-sm text-muted-foreground font-light max-w-md mx-auto">
              AIWholesail analyzes thousands of properties daily. Get instant spread calculations, deal scoring, and market intelligence.
            </p>
            <div className="flex gap-3 justify-center">
              <Link to="/pricing">
                <Button className="rounded-full px-6 gap-2">
                  <Zap className="h-4 w-4" /> Start Free Trial
                </Button>
              </Link>
              <Link to="/blog">
                <Button variant="outline" className="rounded-full px-6 gap-2">
                  <ArrowRight className="h-4 w-4" /> More Articles
                </Button>
              </Link>
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}
