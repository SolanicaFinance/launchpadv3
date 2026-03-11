import { useState, useRef, useEffect } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Loader2, Lightbulb, Vote, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BRAND } from "@/config/branding";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function GovernancePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { solanaAddress } = useAuth();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Create or get conversation on mount
  useEffect(() => {
    const initConversation = async () => {
      // Create a new conversation
      const { data, error } = await supabase
        .from('governance_conversations')
        .insert({
          wallet_address: solanaAddress || null,
        })
        .select('id')
        .single();

      if (!error && data) {
        setConversationId(data.id);
      }
    };

    initConversation();
  }, [solanaAddress]);

  // Save message to database
  const saveMessage = async (role: "user" | "assistant", content: string) => {
    if (!conversationId) return;

    await supabase.from('governance_messages').insert({
      conversation_id: conversationId,
      role,
      content,
    });

    // Update conversation stats
    await supabase
      .from('governance_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        message_count: messages.length + 1,
      })
      .eq('id', conversationId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    // Save user message
    await saveMessage("user", userMessage.content);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: newMessages }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get response");
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      // Add empty assistant message to update progressively
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      let textBuffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
                };
                return updated;
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Save assistant response
      if (assistantContent) {
        await saveMessage("assistant", assistantContent);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      <AppHeader />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Governance</h1>
          <p className="text-gray-400">
            Shape the future of ${BRAND.name} with your suggestions
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-purple-900/30 to-purple-800/10 border-purple-500/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-purple-400 mt-0.5" />
              <div>
                <h3 className="font-semibold text-white text-sm">Share Ideas</h3>
                <p className="text-xs text-gray-400">Suggest features and improvements</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-cyan-900/30 to-cyan-800/10 border-cyan-500/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Vote className="h-5 w-5 text-cyan-400 mt-0.5" />
              <div>
                <h3 className="font-semibold text-white text-sm">Voting Soon</h3>
                <p className="text-xs text-gray-400">Holders will vote on proposals</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-900/30 to-amber-800/10 border-amber-500/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Lock className="h-5 w-5 text-amber-400 mt-0.5" />
              <div>
                <h3 className="font-semibold text-white text-sm">Holder Access</h3>
                <p className="text-xs text-gray-400">Full governance for token holders</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-[#0d0d0f] border-[#1a1a1f]">
          <CardHeader className="border-b border-[#1a1a1f]">
            <CardTitle className="text-white flex items-center gap-2">
              <Bot className="h-5 w-5 text-purple-400" />
              Claw Governance AI
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px] p-4" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center space-y-4">
                    <Bot className="h-12 w-12 mx-auto text-purple-500/50" />
                    <div>
                      <p className="font-medium text-gray-300">Welcome to Governance</p>
                      <p className="text-sm text-gray-500 mt-1">Share your ideas to improve ${BRAND.name}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {["What features are coming?", "How can I suggest improvements?", "Tell me about voting"].map((q) => (
                        <button
                          key={q}
                          onClick={() => setInput(q)}
                          className="px-3 py-1.5 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 rounded-full transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.role === "user"
                            ? "bg-purple-600 text-white"
                            : "bg-[#1a1a1f] text-gray-200"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      {msg.role === "user" && (
                        <div className="h-8 w-8 rounded-full bg-[#1a1a1f] flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-gray-400" />
                        </div>
                      )}
                    </div>
                  ))}
                  {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="bg-[#1a1a1f] rounded-lg p-3">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            <form
              onSubmit={handleSubmit}
              className="border-t border-[#1a1a1f] p-4 flex gap-2"
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Share your ideas for ${BRAND.name}...`}
                className="bg-[#1a1a1f] border-[#2a2a2f] text-white resize-none min-h-[44px] max-h-[120px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
