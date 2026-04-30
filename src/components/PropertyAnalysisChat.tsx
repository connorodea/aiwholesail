import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  Send, 
  Bot, 
  User, 
  TrendingUp, 
  DollarSign, 
  Calculator,
  AlertTriangle,
  CheckCircle,
  Loader2,
  BarChart3
} from 'lucide-react';
import { ai } from '@/lib/api-client';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isAnalyzing?: boolean;
}

interface PropertyAnalysisChatProps {
  property: any;
  isOpen: boolean;
}

export function PropertyAnalysisChat({ property, isOpen }: PropertyAnalysisChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasInitialAnalysis, setHasInitialAnalysis] = useState(false);
  const [showStartButton, setShowStartButton] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen && property) {
      setShowStartButton(!hasInitialAnalysis);
    }
  }, [isOpen, property, hasInitialAnalysis]);

  const runInitialAnalysis = async () => {
    if (!property) return;

    setShowStartButton(false);
    const analysisMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: 'Analyzing this property for investment opportunities...',
      timestamp: new Date(),
      isAnalyzing: true
    };

    setMessages([analysisMessage]);
    setIsLoading(true);

    try {
      const response = await ai.propertyAnalysis(property, undefined, []);

      if (response.error) throw new Error(response.error);

      setMessages([{
        id: Date.now().toString(),
        role: 'assistant',
        content: (response.data as any)?.response || 'Analysis complete. Ask me any questions about this property!',
        timestamp: new Date()
      }]);

      setHasInitialAnalysis(true);
    } catch (error: any) {
      console.error('Analysis error:', error);
      setMessages([{
        id: Date.now().toString(),
        role: 'assistant',
        content: 'I encountered an error analyzing this property. Please try asking me a specific question about the deal potential.',
        timestamp: new Date()
      }]);
      toast.error('Analysis failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: 'Analyzing...',
      timestamp: new Date(),
      isAnalyzing: true
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Prepare conversation history
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await ai.propertyAnalysis(property, userMessage.content, conversationHistory);

      if (response.error) throw new Error(response.error);

      setMessages(prev => prev.slice(0, -1).concat([{
        id: Date.now().toString(),
        role: 'assistant',
        content: (response.data as any)?.response || 'I was unable to process your request. Please try again.',
        timestamp: new Date()
      }]));

    } catch (error: any) {
      console.error('Chat error:', error);
      setMessages(prev => prev.slice(0, -1).concat([{
        id: Date.now().toString(),
        role: 'assistant',
        content: 'I encountered an error processing your question. Please try again.',
        timestamp: new Date()
      }]));
      toast.error('Failed to get response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getMessageIcon = (role: string, isAnalyzing?: boolean) => {
    if (isAnalyzing) return <Loader2 className="h-4 w-4 animate-spin" />;
    return role === 'user' ? <User className="h-4 w-4" /> : <Brain className="h-4 w-4" />;
  };

  const formatContent = (content: string) => {
    const sections = content.split('\n\n');
    return sections.map((section, index) => {
      // Format headings
      if (section.match(/^[A-Z\s:]+$/m) || section.includes('##') || section.includes('**')) {
        return (
          <div key={index} className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-foreground flex items-center gap-2">
              {section.includes('MARKET') && <BarChart3 className="h-4 w-4" />}
              {section.includes('FINANCIAL') && <Calculator className="h-4 w-4" />}
              {section.includes('RISK') && <AlertTriangle className="h-4 w-4" />}
              {section.includes('RECOMMENDATION') && <CheckCircle className="h-4 w-4" />}
              {section.replace(/[#*]/g, '').trim()}
            </h3>
          </div>
        );
      }
      
      // Format financial metrics in cards
      if (section.includes('$') || section.includes('%')) {
        const lines = section.split('\n');
        return (
          <div key={index} className="mb-4 p-4 bg-muted/50 rounded-lg border">
            {lines.map((line, lineIndex) => {
              if (line.includes('$') || line.includes('%')) {
                const hasPositive = line.toLowerCase().includes('profit') || 
                                  line.toLowerCase().includes('spread') || 
                                  line.toLowerCase().includes('opportunity') ||
                                  line.toLowerCase().includes('margin');
                const hasNegative = line.toLowerCase().includes('risk') || 
                                  line.toLowerCase().includes('concern') || 
                                  line.toLowerCase().includes('issue') ||
                                  line.toLowerCase().includes('loss');
                
                return (
                  <div key={lineIndex} className={`font-semibold text-sm ${
                    hasPositive ? 'text-emerald-600 dark:text-emerald-400' : 
                    hasNegative ? 'text-red-600 dark:text-red-400' : 
                    'text-blue-600 dark:text-blue-400'
                  }`}>
                    {line}
                  </div>
                );
              }
              return (
                <div key={lineIndex} className="text-sm text-muted-foreground leading-relaxed">
                  {line}
                </div>
              );
            })}
          </div>
        );
      }
      
      // Format bullet points
      if (section.includes('•') || section.includes('-')) {
        const lines = section.split('\n');
        return (
          <div key={index} className="mb-4">
            {lines.map((line, lineIndex) => (
              <div key={lineIndex} className="flex items-start gap-2 mb-2 text-sm">
                {(line.includes('•') || line.includes('-')) && (
                  <div className="w-1 h-1 bg-primary rounded-full mt-2 flex-shrink-0" />
                )}
                <span className="text-muted-foreground leading-relaxed">
                  {line.replace(/^[•-]\s*/, '')}
                </span>
              </div>
            ))}
          </div>
        );
      }
      
      return (
        <div key={index} className="mb-4 text-sm text-muted-foreground leading-relaxed">
          {section}
        </div>
      );
    });
  };

  const quickQuestions = [
    "What's the deal potential of this property?",
    "Calculate the 70% ARV rule for this deal",
    "What repairs might this property need?",
    "How does this compare to market comps?",
    "What's the investment risk assessment?"
  ];

  if (!isOpen) return null;

  return (
    <div className="w-full h-[700px] flex flex-col bg-background">
      {/* Header */}
      <div className="p-6 border-b bg-gradient-to-r from-background to-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">AI Deal Analysis</h2>
              <p className="text-sm text-muted-foreground">
                Expert analysis powered by Claude Sonnet 4
              </p>
            </div>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {property?.address?.split(',')[0] || 'Property Analysis'}
          </Badge>
        </div>
      </div>
      
      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <ScrollArea className="flex-1 p-6" ref={scrollAreaRef}>
          <div className="max-w-none space-y-6 pb-4">
            {/* Initial state with start button */}
            {showStartButton && messages.length === 0 && (
              <div className="text-center py-12">
                <div className="p-4 rounded-full bg-gradient-to-br from-primary/10 to-blue-500/10 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                  <Brain className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Ready to Analyze</h3>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  Get comprehensive deal analysis using advanced AI, market data, and property insights
                </p>
                <Button 
                  onClick={runInitialAnalysis}
                  disabled={isLoading}
                  size="lg"
                  className="gap-2 px-8"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing Property...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4" />
                      Start AI Analysis
                    </>
                  )}
                </Button>
              </div>
            )}
            
            {/* Messages */}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-4 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className={`p-2 rounded-xl ${
                    message.isAnalyzing 
                      ? 'bg-gradient-to-br from-blue-500/10 to-primary/10' 
                      : 'bg-gradient-to-br from-primary/10 to-muted'
                  } flex-shrink-0`}>
                    {getMessageIcon(message.role, message.isAnalyzing)}
                  </div>
                )}
                
                <div
                  className={`max-w-[85%] rounded-2xl p-4 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground ml-12'
                      : 'bg-card border shadow-sm'
                  }`}
                >
                  <div className={message.role === 'assistant' ? 'prose prose-sm max-w-none' : ''}>
                    {message.role === 'assistant' && !message.isAnalyzing ? 
                      <div className="space-y-3">{formatContent(message.content)}</div> : 
                      <div className="text-sm">{message.content}</div>
                    }
                  </div>
                  <div className={`text-xs mt-3 ${
                    message.role === 'user' 
                      ? 'text-primary-foreground/70' 
                      : 'text-muted-foreground'
                  }`}>
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
                
                {message.role === 'user' && (
                  <div className="p-2 rounded-xl bg-primary/10 flex-shrink-0">
                    {getMessageIcon(message.role)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Quick Questions */}
        {messages.length > 0 && !isLoading && (
          <div className="p-4 border-t bg-muted/20">
            <div className="text-xs font-medium text-muted-foreground mb-3">Suggested questions:</div>
            <div className="flex flex-wrap gap-2">
              {quickQuestions.map((question, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  className="text-xs h-8 bg-background hover:bg-muted border"
                  onClick={() => setInput(question)}
                >
                  {question}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-6 border-t bg-background">
          <div className="flex gap-3">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about deal potential, ARV, repair estimates, or market analysis..."
              disabled={isLoading || showStartButton}
              className="flex-1 h-11 bg-background border-border focus:ring-2 focus:ring-primary/20"
            />
            <Button 
              onClick={sendMessage} 
              disabled={!input.trim() || isLoading || showStartButton}
              size="lg"
              className="h-11 px-6"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Powered by Claude Sonnet 4 • Enhanced with real-time market data
          </div>
        </div>
      </div>
    </div>
  );
}