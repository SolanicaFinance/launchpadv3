import { useState, useRef, useEffect } from "react";
import { Send, Loader2, X } from "lucide-react";
import { Robot } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import clawLogo from "@/assets/moondexo-logo.png";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  "what is claw mode?",
  "how do i launch a token?",
  "tell me about the lobster life",
  "what's your wallet looking like?",
];

interface ConsoleDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConsoleDrawer({ open, onOpenChange }: ConsoleDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

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
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "something went wrong in the depths... try again 🦞",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="p-0 w-[380px] sm:w-[420px] border-l border-border bg-background flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <img src={clawLogo} alt="" className="h-8 w-8 rounded-full" />
          <div>
            <h2 className="text-sm font-bold text-foreground">Claw Console</h2>
            <p className="text-[11px] text-muted-foreground">talk to the lobster</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] text-success font-medium">Online</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[300px]">
              <div className="text-center space-y-4 max-w-sm">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-accent-orange/10 flex items-center justify-center">
                  <img src={clawLogo} alt="" className="h-10 w-10 rounded-lg" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">hey, i'm claw 🦞</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ask me anything about claw mode, crypto, or just vibe.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
                      className="px-3 py-1.5 text-[11px] bg-surface hover:bg-surface-hover text-muted-foreground hover:text-foreground rounded-full border border-border transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <img src={clawLogo} alt="" className="h-7 w-7 rounded-full flex-shrink-0 mt-0.5" />
                  )}
                  <div
                    className={`max-w-[80%] rounded-xl px-3.5 py-2.5 ${
                      msg.role === "user"
                        ? "bg-accent-purple text-white"
                        : "bg-surface border border-border text-foreground"
                    }`}
                  >
                    <p className="text-[13px] whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                  {msg.role === "user" && (
                    <div className="h-7 w-7 rounded-full bg-surface border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Robot size={14} className="text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex gap-2.5">
                  <img src={clawLogo} alt="" className="h-7 w-7 rounded-full flex-shrink-0" />
                  <div className="bg-surface border border-border rounded-xl px-3.5 py-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="border-t border-border p-3 flex gap-2"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="say something to the lobster..."
            className="bg-surface border-border text-foreground resize-none min-h-[40px] max-h-[100px] text-[13px] rounded-xl"
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
            size="icon"
            className="bg-accent-orange hover:bg-accent-orange/80 text-white h-10 w-10 rounded-xl flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
