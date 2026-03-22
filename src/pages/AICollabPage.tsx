import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

interface CollabMessage {
  id: string;
  session_id: string;
  round_number: number;
  role: string;
  message_type: string;
  content: string;
  target_role: string | null;
  created_at: string;
}

interface CollabSession {
  id: string;
  title: string;
  initial_task: string;
  status: string;
  current_round: number;
  max_rounds: number;
  created_at: string;
}

const AI_CONFIG: Record<string, { name: string; emoji: string; color: string; border: string; bg: string }> = {
  gemini_pro: { name: "Gemini Pro", emoji: "🧠", color: "text-blue-400", border: "border-blue-500/30", bg: "bg-blue-500/10" },
  gpt5: { name: "GPT-5", emoji: "⚡", color: "text-yellow-400", border: "border-yellow-500/30", bg: "bg-yellow-500/10" },
  gemini_flash: { name: "Gemini Flash", emoji: "🔥", color: "text-orange-400", border: "border-orange-500/30", bg: "bg-orange-500/10" },
  user: { name: "You", emoji: "👤", color: "text-green-400", border: "border-green-500/30", bg: "bg-green-500/10" },
  system: { name: "Final Spec", emoji: "📋", color: "text-purple-400", border: "border-purple-500/30", bg: "bg-purple-500/10" },
};

const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-collab`;

async function callAPI(body: any) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 429) throw new Error("Rate limited — wait a moment and try again");
    if (res.status === 402) throw new Error("AI credits exhausted — top up in Settings");
    throw new Error(data.error || "Request failed");
  }
  return data;
}

export default function AICollabPage() {
  const [sessions, setSessions] = useState<CollabSession[]>([]);
  const [activeSession, setActiveSession] = useState<CollabSession | null>(null);
  const [messages, setMessages] = useState<CollabMessage[]>([]);
  const [task, setTask] = useState("");
  const [userComment, setUserComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState("");
  const [showSessions, setShowSessions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadSessions() {
    try {
      const data = await callAPI({ action: "list" });
      setSessions(data.sessions || []);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function createSession() {
    if (!task.trim()) return;
    setIsLoading(true);
    setLoadingPhase("Creating session...");
    try {
      const data = await callAPI({ action: "create", task: task.trim() });
      setActiveSession(data.session);
      setMessages([]);
      setTask("");
      setShowSessions(false);
      toast.success("Session created! Click 'Run Round' to start the AI collaboration.");
      await loadSessions();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
      setLoadingPhase("");
    }
  }

  async function runRound() {
    if (!activeSession) return;
    setIsLoading(true);
    setLoadingPhase("AIs generating ideas...");
    try {
      const data = await callAPI({
        action: "generate",
        sessionId: activeSession.id,
        userComment: userComment.trim() || undefined,
      });
      setUserComment("");
      setLoadingPhase("Loading updated history...");
      // Reload full history
      const history = await callAPI({ action: "history", sessionId: activeSession.id });
      setMessages(history.messages || []);
      setActiveSession(history.session);
      toast.success(`Round ${data.round} complete!`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
      setLoadingPhase("");
    }
  }

  async function finalize() {
    if (!activeSession) return;
    setIsLoading(true);
    setLoadingPhase("Synthesizing final specification...");
    try {
      const data = await callAPI({ action: "finalize", sessionId: activeSession.id });
      const history = await callAPI({ action: "history", sessionId: activeSession.id });
      setMessages(history.messages || []);
      setActiveSession(history.session);
      toast.success("Final spec generated!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
      setLoadingPhase("");
    }
  }

  async function loadSession(session: CollabSession) {
    setIsLoading(true);
    try {
      const data = await callAPI({ action: "history", sessionId: session.id });
      setActiveSession(data.session);
      setMessages(data.messages || []);
      setShowSessions(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  // Group messages by round
  const rounds = messages.reduce((acc, msg) => {
    if (!acc[msg.round_number]) acc[msg.round_number] = [];
    acc[msg.round_number].push(msg);
    return acc;
  }, {} as Record<number, CollabMessage[]>);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0d0d15]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤖</span>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 via-yellow-400 to-orange-400 bg-clip-text text-transparent">
                AI Collab Arena
              </h1>
              <p className="text-xs text-white/40">3 AIs compete & collaborate on your ideas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeSession && (
              <button
                onClick={() => { setShowSessions(true); setActiveSession(null); }}
                className="px-3 py-1.5 text-xs border border-white/10 rounded-lg hover:bg-white/5 transition"
              >
                ← Sessions
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Sessions List */}
        {showSessions && !activeSession && (
          <div className="space-y-6">
            {/* New Session */}
            <div className="border border-white/10 rounded-xl p-6 bg-[#0d0d15]">
              <h2 className="text-lg font-semibold mb-3">🚀 Start New Collaboration</h2>
              <p className="text-sm text-white/50 mb-4">
                Describe your product idea or task. 3 AI models will independently generate ideas, 
                then review and challenge each other across multiple rounds.
              </p>
              <textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="e.g. Design a decentralized identity system built on Bitcoin that enables trustless reputation scoring for DeFi protocols..."
                className="w-full bg-black/40 border border-white/10 rounded-lg p-4 text-sm text-white placeholder:text-white/30 resize-none h-32 focus:outline-none focus:border-blue-500/50"
              />
              <button
                onClick={createSession}
                disabled={!task.trim() || isLoading}
                className="mt-3 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-medium text-sm hover:opacity-90 transition disabled:opacity-40"
              >
                {isLoading ? "Creating..." : "Launch Collaboration"}
              </button>
            </div>

            {/* Past Sessions */}
            {sessions.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">📂 Past Sessions</h2>
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => loadSession(s)}
                      className="w-full text-left border border-white/10 rounded-lg p-4 bg-[#0d0d15] hover:bg-white/5 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-sm">{s.title}</span>
                          <span className={`ml-2 text-xs px-2 py-0.5 rounded ${s.status === 'finalized' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            {s.status}
                          </span>
                        </div>
                        <span className="text-xs text-white/40">Round {s.current_round} · {new Date(s.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-white/40 mt-1 truncate">{s.initial_task}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active Session */}
        {activeSession && (
          <div className="space-y-4">
            {/* Session Header */}
            <div className="border border-white/10 rounded-xl p-4 bg-[#0d0d15]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-lg">{activeSession.title}</h2>
                  <p className="text-xs text-white/40 mt-1">
                    Round {activeSession.current_round}/{activeSession.max_rounds} · Status: {activeSession.status}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {Object.entries(AI_CONFIG).filter(([k]) => !['user', 'system'].includes(k)).map(([key, config]) => (
                    <div key={key} className={`flex items-center gap-1 text-xs ${config.color}`}>
                      <span>{config.emoji}</span>
                      <span>{config.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Messages by Round */}
            <div className="space-y-6">
              {Object.entries(rounds).map(([roundNum, msgs]) => (
                <div key={roundNum} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-px bg-white/10 flex-1" />
                    <span className="text-xs text-white/30 font-mono">ROUND {roundNum}</span>
                    <div className="h-px bg-white/10 flex-1" />
                  </div>

                  {/* Group by type within round */}
                  {(() => {
                    const ideas = msgs.filter(m => m.message_type === 'idea');
                    const reviews = msgs.filter(m => m.message_type === 'review');
                    const comments = msgs.filter(m => m.message_type === 'comment');
                    const tasks = msgs.filter(m => m.message_type === 'task');
                    const finals = msgs.filter(m => m.message_type === 'final');

                    return (
                      <>
                        {tasks.map(m => <MessageCard key={m.id} msg={m} />)}
                        {comments.map(m => <MessageCard key={m.id} msg={m} />)}
                        
                        {ideas.length > 0 && (
                          <div>
                            <h4 className="text-xs text-white/30 uppercase tracking-wider mb-2 ml-1">💡 Ideas</h4>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                              {ideas.map(m => <MessageCard key={m.id} msg={m} compact />)}
                            </div>
                          </div>
                        )}
                        
                        {reviews.length > 0 && (
                          <div>
                            <h4 className="text-xs text-white/30 uppercase tracking-wider mb-2 ml-1">🔍 Reviews</h4>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                              {reviews.map(m => <MessageCard key={m.id} msg={m} compact />)}
                            </div>
                          </div>
                        )}

                        {finals.map(m => <MessageCard key={m.id} msg={m} />)}
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>

            <div ref={messagesEndRef} />

            {/* Loading indicator */}
            {isLoading && (
              <div className="border border-white/10 rounded-xl p-6 bg-[#0d0d15] flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-transparent border-t-blue-400 border-r-yellow-400 border-b-orange-400 rounded-full animate-spin" />
                <span className="text-sm text-white/60">{loadingPhase}</span>
              </div>
            )}

            {/* Controls */}
            {activeSession.status !== "finalized" && !isLoading && (
              <div className="border border-white/10 rounded-xl p-4 bg-[#0d0d15] space-y-3">
                <textarea
                  value={userComment}
                  onChange={(e) => setUserComment(e.target.value)}
                  placeholder="Add your feedback/direction for the AIs (optional)..."
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-white/30 resize-none h-20 focus:outline-none focus:border-blue-500/50"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={runRound}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-medium text-sm hover:opacity-90 transition"
                  >
                    🔄 Run Round {(activeSession.current_round || 0) + 1}
                  </button>
                  {activeSession.current_round >= 2 && (
                    <button
                      onClick={finalize}
                      className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg font-medium text-sm hover:opacity-90 transition"
                    >
                      ✅ Finalize & Generate Spec
                    </button>
                  )}
                  <span className="text-xs text-white/30 ml-auto">
                    {activeSession.current_round >= 2 ? "Ready to finalize or keep iterating" : `${2 - activeSession.current_round} more round(s) before you can finalize`}
                  </span>
                </div>
              </div>
            )}

            {/* Final spec copy button */}
            {activeSession.status === "finalized" && (
              <div className="border border-green-500/30 rounded-xl p-4 bg-green-500/5">
                <p className="text-sm text-green-400 mb-2">✅ Session finalized! Copy the spec above and send it to Lovable to build.</p>
                <button
                  onClick={() => {
                    const finalMsg = messages.find(m => m.message_type === 'final');
                    if (finalMsg) {
                      navigator.clipboard.writeText(finalMsg.content);
                      toast.success("Spec copied to clipboard!");
                    }
                  }}
                  className="px-4 py-2 bg-green-600 rounded-lg text-sm font-medium hover:opacity-90 transition"
                >
                  📋 Copy Final Spec
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageCard({ msg, compact }: { msg: CollabMessage; compact?: boolean }) {
  const config = AI_CONFIG[msg.role] || AI_CONFIG.user;
  const [expanded, setExpanded] = useState(!compact);

  return (
    <div className={`border ${config.border} rounded-lg ${config.bg} overflow-hidden`}>
      <div
        className={`flex items-center gap-2 px-3 py-2 ${compact ? 'cursor-pointer' : ''}`}
        onClick={() => compact && setExpanded(!expanded)}
      >
        <span>{config.emoji}</span>
        <span className={`text-xs font-medium ${config.color}`}>{config.name}</span>
        <span className="text-[10px] text-white/20 uppercase">{msg.message_type}</span>
        {compact && (
          <span className="ml-auto text-[10px] text-white/20">{expanded ? '▼' : '▶'}</span>
        )}
      </div>
      {expanded && (
        <div className="px-3 pb-3">
          <div className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">
            {msg.content}
          </div>
        </div>
      )}
    </div>
  );
}
