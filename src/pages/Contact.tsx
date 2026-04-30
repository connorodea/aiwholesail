import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Mail, MessageCircle, Phone, MapPin, Send } from 'lucide-react';
import { toast } from 'sonner';
import { SEOHead } from '@/components/SEOHead';

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SEOHead 
        title="Contact Us"
        description="Get in touch with the AIWholesail support team. We're here to help with questions about our real estate investing platform."
        noIndex={false}
      />
      
      {/* Header */}
      <header className="fixed top-4 left-4 right-4 z-50">
        <div className="container mx-auto max-w-7xl">
          <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-lg px-6 py-4">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center space-x-2 text-sm font-medium hover:text-primary transition-colors">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Home</span>
              </Link>
              <div className="text-lg font-semibold">Contact Us</div>
              <div className="w-20"></div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="pt-32 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Get in Touch</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Have questions about AI Wholesail? We're here to help. Reach out to our team 
              and we'll get back to you as soon as possible.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <Card className="border border-border/50 rounded-2xl shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <MessageCircle className="h-6 w-6 text-primary" />
                  Send us a Message
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Your full name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      placeholder="What's this about?"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      placeholder="Tell us how we can help..."
                      rows={6}
                      required
                    />
                  </div>
                  
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin"></div>
                        Sending...
                      </div>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Message
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <div className="space-y-8">
              <Card className="border border-border/50 rounded-2xl shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Mail className="h-6 w-6 text-primary" />
                    <h3 className="text-lg font-semibold">Email Support</h3>
                  </div>
                  <p className="text-muted-foreground mb-2">
                    Get help with your account, billing, or technical issues.
                  </p>
                  <a href="mailto:support@aiwholesail.com" className="text-primary hover:underline font-medium">
                    support@aiwholesail.com
                  </a>
                  <p className="text-sm text-muted-foreground mt-2">
                    Response time: Within 24 hours
                  </p>
                </CardContent>
              </Card>

              <Card className="border border-border/50 rounded-2xl shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Phone className="h-6 w-6 text-primary" />
                    <h3 className="text-lg font-semibold">Sales Inquiries</h3>
                  </div>
                  <p className="text-muted-foreground mb-2">
                    Questions about pricing, features, or enterprise solutions?
                  </p>
                  <a href="mailto:sales@aiwholesail.com" className="text-primary hover:underline font-medium">
                    sales@aiwholesail.com
                  </a>
                  <p className="text-sm text-muted-foreground mt-2">
                    Response time: Within 4 hours (business days)
                  </p>
                </CardContent>
              </Card>

              <Card className="border border-border/50 rounded-2xl shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <MapPin className="h-6 w-6 text-primary" />
                    <h3 className="text-lg font-semibold">Business Hours</h3>
                  </div>
                  <div className="space-y-2 text-muted-foreground">
                    <p>Monday - Friday: 9:00 AM - 6:00 PM EST</p>
                    <p>Saturday: 10:00 AM - 4:00 PM EST</p>
                    <p>Sunday: Closed</p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">
                    Emergency support available 24/7 for critical issues
                  </p>
                </CardContent>
              </Card>

              {/* FAQ Link */}
              <Card className="border border-primary/20 bg-primary/5 rounded-2xl shadow-lg">
                <CardContent className="p-6 text-center">
                  <h3 className="text-lg font-semibold mb-2">Need Quick Answers?</h3>
                  <p className="text-muted-foreground mb-4">
                    Check our FAQ section for common questions and instant solutions.
                  </p>
                  <Link to="/faq">
                    <Button variant="outline" className="border-primary/30 hover:bg-primary/10">
                      Visit FAQ Section
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}