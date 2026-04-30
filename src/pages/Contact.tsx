import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Mail, MessageCircle, Phone, MapPin, Send, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // TODO: Implement actual form submission logic
      // This could send to a Supabase edge function or email service
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

      toast.success('Message sent successfully! We\'ll get back to you within 24 hours.');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      toast.error('Failed to send message. Please try again or email us directly.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <PublicLayout>
      <SEOHead
        title="Contact Us"
        description="Get in touch with the AIWholesail support team. We're here to help with questions about our real estate investing platform."
        noIndex={false}
      />

      {/* ===== HERO — DARK ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <div className="relative container mx-auto max-w-6xl px-4 pt-24 pb-20 text-center">
          <Badge className="mb-6 bg-white/10 text-white/80 border-white/10 backdrop-blur-sm text-xs font-medium px-4 py-1.5 rounded-full">
            <MessageCircle className="h-3 w-3 mr-1.5" /> We're Here to Help
          </Badge>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Get in touch.
          </h1>

          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed font-light">
            Have questions about AIWholesail? Our team is ready to help you
            get started and make the most of the platform.
          </p>
        </div>

        {/* Fade to white */}
        <div className="h-24 bg-gradient-to-b from-[#0a0a0a] to-background" />
      </section>

      {/* ===== CONTACT FORM + INFO — LIGHT ===== */}
      <section className="py-24 px-4 bg-background">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Contact Form */}
            <div className="bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 rounded-3xl p-8 md:p-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Send className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Send us a message</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Your full name"
                      required
                      className="h-11 bg-muted/50 border-border/50 focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="your@email.com"
                      required
                      className="h-11 bg-muted/50 border-border/50 focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-sm font-medium">Subject</Label>
                  <Input
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder="What's this about?"
                    required
                    className="h-11 bg-muted/50 border-border/50 focus:border-primary transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="text-sm font-medium">Message</Label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Tell us how we can help..."
                    rows={6}
                    required
                    className="bg-muted/50 border-border/50 focus:border-primary transition-colors"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 font-semibold text-base gap-2"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                      Sending...
                    </div>
                  ) : (
                    <>
                      Send Message
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 rounded-3xl p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight">Email Support</h3>
                </div>
                <p className="text-muted-foreground font-light mb-3">
                  Get help with your account, billing, or any questions.
                </p>
                <a href="mailto:support@aiwholesail.com" className="text-primary hover:text-primary/80 font-medium transition-colors">
                  support@aiwholesail.com
                </a>
                <p className="text-sm text-muted-foreground font-light mt-2">
                  Response time: Within 24 hours
                </p>
              </div>

              <div className="bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 rounded-3xl p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight">Sales Inquiries</h3>
                </div>
                <p className="text-muted-foreground font-light mb-3">
                  Questions about pricing, features, or enterprise solutions?
                </p>
                <a href="mailto:sales@aiwholesail.com" className="text-primary hover:text-primary/80 font-medium transition-colors">
                  sales@aiwholesail.com
                </a>
                <p className="text-sm text-muted-foreground font-light mt-2">
                  Response time: Within 4 hours (business days)
                </p>
              </div>

              <div className="bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 rounded-3xl p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight">Business Hours</h3>
                </div>
                <div className="space-y-1.5 text-muted-foreground font-light">
                  <p>Monday - Friday: 9:00 AM - 6:00 PM EST</p>
                  <p>Saturday: 10:00 AM - 4:00 PM EST</p>
                  <p>Sunday: Closed</p>
                </div>
                <p className="text-sm text-muted-foreground font-light mt-3">
                  Emergency support available 24/7 for critical issues
                </p>
              </div>

              <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-3xl p-8 text-center">
                <h3 className="text-lg font-bold tracking-tight mb-2">Need quick answers?</h3>
                <p className="text-muted-foreground font-light mb-5">
                  Check our FAQ section for common questions and instant solutions.
                </p>
                <Link to="/faq">
                  <Button variant="outline" className="rounded-full px-6 border-primary/30 hover:bg-primary/10 font-medium">
                    Visit FAQ Section
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
