import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { ai } from '@/lib/api-client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  searchPerformed?: boolean;
}

export const ChatAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! I\'m your AI real estate assistant. I can help you with market analysis, property evaluation, investment strategies, and platform features. I can also search the web for specific property information. How can I help you today?',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const detectPropertyUrl = (message: string): string | null => {
    const urlPattern = /(https?:\/\/[^\s]+(?:zillow|realtor|realty|homes)\.com[^\s]*)/i;
    const match = message.match(urlPattern);
    return match ? match[1] : null;
  };

  const extractSearchQuery = (message: string): string => {
    const propertyUrl = detectPropertyUrl(message);
    if (propertyUrl) {
      return `site:${new URL(propertyUrl).hostname} ${propertyUrl}`;
    }
    
    // Extract location or property-related keywords
    const searchTerms = message.toLowerCase().match(/\b(?:property|house|home|real estate|market|price|value|zestimate|comparable|comp|analysis)\b/g);
    const locationTerms = message.match(/\b[A-Z][a-zA-Z\s]+(?:,\s*[A-Z]{2}|\s+(?:street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|lane|ln))\b/g);
    
    let query = '';
    if (locationTerms) {
      query += locationTerms[0] + ' ';
    }
    if (searchTerms) {
      query += searchTerms.slice(0, 2).join(' ');
    }
    
    return query.trim() || message.slice(0, 100);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const autoSearchQuery = searchQuery || extractSearchQuery(inputMessage);

      const response = await ai.chat(inputMessage, { searchQuery: autoSearchQuery });

      if (response.error) throw new Error(response.error);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: (response.data as any)?.response || 'I apologize, but I could not generate a response.',
        timestamp: new Date(),
        searchPerformed: false
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
      setInputMessage('');
      setSearchQuery('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-primary hover:bg-primary/90"
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-96 h-[500px] shadow-xl border border-border bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">AI Assistant</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(false)}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                {message.searchPerformed && (
                  <div className="flex items-center gap-1 mt-2 text-xs opacity-70">
                    <Search className="h-3 w-3" />
                    <span>Web search performed</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted text-muted-foreground rounded-lg p-3">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Optional: Search query for web results"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-sm"
          />
          <Search className="h-4 w-4 text-muted-foreground mt-3" />
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Ask about properties, market data, or platform features..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          <Button
            onClick={sendMessage}
            disabled={isLoading || !inputMessage.trim()}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};