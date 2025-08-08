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
import { supabase } from '@/integrations/supabase/client';
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

  // Initial analysis when component mounts
  useEffect(() => {
    if (isOpen && property && !hasInitialAnalysis) {
      runInitialAnalysis();
    }
  }, [isOpen, property, hasInitialAnalysis]);

  const runInitialAnalysis = async () => {
    if (!property) return;

    const analysisMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: 'Analyzing this property for wholesale opportunities...',
      timestamp: new Date(),
      isAnalyzing: true
    };

    setMessages([analysisMessage]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-property-analysis', {
        body: {
          property,
          userMessage: null, // Initial analysis
          conversationHistory: []
        }
      });

      if (error) throw error;

      setMessages([{
        id: Date.now().toString(),
        role: 'assistant',
        content: data.response || 'Analysis complete. Ask me any questions about this property!',
        timestamp: new Date()
      }]);

      setHasInitialAnalysis(true);
    } catch (error: any) {
      console.error('Analysis error:', error);
      setMessages([{
        id: Date.now().toString(),
        role: 'assistant',
        content: 'I encountered an error analyzing this property. Please try asking me a specific question about the wholesale potential.',
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

      const { data, error } = await supabase.functions.invoke('ai-property-analysis', {
        body: {
          property,
          userMessage: userMessage.content,
          conversationHistory
        }
      });

      if (error) throw error;

      setMessages(prev => prev.slice(0, -1).concat([{
        id: Date.now().toString(),
        role: 'assistant',
        content: data.response || 'I was unable to process your request. Please try again.',
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
    // Simple formatting for key metrics
    const sections = content.split('\n\n');
    return sections.map((section, index) => {
      if (section.includes('$') || section.includes('%')) {
        return (
          <div key={index} className="mb-3">
            {section.split('\n').map((line, lineIndex) => {
              if (line.includes('$') || line.includes('%')) {
                const hasPositive = line.includes('profit') || line.includes('spread') || line.includes('opportunity');
                const hasNegative = line.includes('risk') || line.includes('concern') || line.includes('issue');
                
                return (
                  <div key={lineIndex} className={`font-medium ${hasPositive ? 'text-green-600' : hasNegative ? 'text-red-600' : 'text-blue-600'}`}>
                    {line}
                  </div>
                );
              }
              return <div key={lineIndex}>{line}</div>;
            })}
          </div>
        );
      }
      return <div key={index} className="mb-3">{section}</div>;
    });
  };

  const quickQuestions = [
    "What's the wholesale potential of this property?",
    "Calculate the 70% ARV rule for this deal",
    "What repairs might this property need?",
    "How does this compare to market comps?",
    "What's the investment risk assessment?"
  ];

  if (!isOpen) return null;

  return (
    <Card className="w-full h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          AI Wholesale Analysis
          <Badge variant="outline" className="ml-auto">
            {property?.address || 'Property Analysis'}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 px-4" ref={scrollAreaRef}>
          <div className="space-y-4 pb-4">
            {messages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">AI Property Analysis</h3>
                <p>Get expert wholesale analysis using advanced AI and real estate data</p>
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className={`p-2 rounded-full ${message.isAnalyzing ? 'bg-blue-100' : 'bg-primary/10'}`}>
                    {getMessageIcon(message.role, message.isAnalyzing)}
                  </div>
                )}
                
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <div className="text-sm">
                    {message.role === 'assistant' && !message.isAnalyzing ? 
                      formatContent(message.content) : 
                      message.content
                    }
                  </div>
                  <div className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
                
                {message.role === 'user' && (
                  <div className="p-2 rounded-full bg-primary/10">
                    {getMessageIcon(message.role)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {messages.length > 0 && !isLoading && (
          <>
            <Separator />
            <div className="p-3">
              <div className="text-xs text-muted-foreground mb-2">Quick questions:</div>
              <div className="flex flex-wrap gap-1">
                {quickQuestions.map((question, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setInput(question)}
                  >
                    {question}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}

        <Separator />
        <div className="p-4">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about wholesale potential, repairs, comps, or investment metrics..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={sendMessage} 
              disabled={!input.trim() || isLoading}
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}