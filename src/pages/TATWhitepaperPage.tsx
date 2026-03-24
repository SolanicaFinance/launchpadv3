import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function TATWhitepaperPage() {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/TAT_Protocol_Technical_Specification.md")
      .then((res) => res.arrayBuffer())
      .then((buf) => {
        // Force decode as UTF-8 regardless of server headers
        const decoder = new TextDecoder("utf-8");
        setContent(decoder.decode(buf));
      })
      .catch(() => setContent("Failed to load specification."))
      .finally(() => setLoading(false));
  }, []);

  // Simple markdown-to-HTML renderer for code blocks, headers, bold, lists, links, tables, hr
  const renderMarkdown = (md: string) => {
    const lines = md.split("\n");
    const html: string[] = [];
    let inCode = false;
    let inTable = false;
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Code blocks
      if (line.startsWith("```")) {
        if (inCode) {
          html.push("</pre>");
          inCode = false;
        } else {
          inCode = true;
          html.push('<pre class="wp-code">');
        }
        continue;
      }
      if (inCode) {
        html.push(escapeHtml(line) + "\n");
        continue;
      }

      // Close list if no longer a list item
      if (inList && !line.startsWith("- ") && !line.startsWith("  - ") && line.trim() !== "") {
        html.push("</ul>");
        inList = false;
      }

      // Horizontal rule
      if (line.trim() === "---") {
        html.push('<hr class="wp-hr" />');
        continue;
      }

      // Tables
      if (line.includes("|") && line.trim().startsWith("|")) {
        const cells = line.split("|").filter(Boolean).map((c) => c.trim());
        if (cells.every((c) => /^[-:]+$/.test(c))) continue; // separator row
        if (!inTable) {
          html.push('<table class="wp-table">');
          inTable = true;
        }
        const tag = !inTable || i === lines.findIndex((l) => l.includes("|") && l.trim().startsWith("|")) ? "th" : "td";
        html.push("<tr>" + cells.map((c) => `<${tag}>${inlineFormat(c)}</${tag}>`).join("") + "</tr>");
        continue;
      }
      if (inTable && (!line.includes("|") || !line.trim().startsWith("|"))) {
        html.push("</table>");
        inTable = false;
      }

      // Empty line
      if (line.trim() === "") {
        html.push("<br />");
        continue;
      }

      // Headers
      const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        html.push(`<h${level} class="wp-h${level}">${inlineFormat(headerMatch[2])}</h${level}>`);
        continue;
      }

      // List items
      if (line.startsWith("- ") || line.startsWith("  - ")) {
        if (!inList) {
          html.push('<ul class="wp-list">');
          inList = true;
        }
        html.push(`<li>${inlineFormat(line.replace(/^\s*-\s/, ""))}</li>`);
        continue;
      }

      // Regular paragraph
      html.push(`<p class="wp-p">${inlineFormat(line)}</p>`);
    }

    if (inCode) html.push("</pre>");
    if (inTable) html.push("</table>");
    if (inList) html.push("</ul>");

    return html.join("\n");
  };

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const inlineFormat = (text: string) => {
    return text
      .replace(/`([^`]+)`/g, '<code class="wp-inline-code">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="wp-link" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/—/g, "—")
      .replace(/→/g, "→");
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a0a", color: "#e0e0e0" }}>
      {/* Header bar */}
      <div className="sticky top-0 z-10 border-b border-border/20 px-4 py-3 flex items-center gap-3" style={{ backgroundColor: "#0d0d0d" }}>
        <button
          onClick={() => navigate("/btc")}
          className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="w-px h-5 bg-border/20" />
        <h1 className="text-sm font-semibold text-foreground">TAT Protocol — Technical Specification</h1>
        <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold ml-auto">v1.0</span>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse mr-2" />
            <span className="text-sm text-muted-foreground font-mono">Loading specification...</span>
          </div>
        ) : (
          <div
            className="whitepaper-content"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        )}
      </div>

      <style>{`
        .whitepaper-content {
          font-family: 'IBM Plex Mono', 'SF Mono', Monaco, monospace;
          font-size: 13px;
          line-height: 1.7;
          color: #d0d0d0;
        }
        .wp-h1 { font-size: 24px; font-weight: 700; color: #fff; margin: 32px 0 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; }
        .wp-h2 { font-size: 18px; font-weight: 700; color: #f0f0f0; margin: 28px 0 12px; }
        .wp-h3 { font-size: 15px; font-weight: 600; color: #e0e0e0; margin: 20px 0 8px; }
        .wp-h4 { font-size: 13px; font-weight: 600; color: #ccc; margin: 16px 0 8px; }
        .wp-p { margin: 6px 0; }
        .wp-hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 24px 0; }
        .wp-list { padding-left: 24px; margin: 8px 0; }
        .wp-list li { margin: 4px 0; list-style-type: disc; }
        .wp-list li::marker { color: hsl(30, 100%, 50%); }
        .wp-code {
          display: block;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 16px;
          overflow-x: auto;
          font-size: 11px;
          line-height: 1.5;
          color: #aaa;
          margin: 12px 0;
          white-space: pre;
        }
        .wp-inline-code {
          background: rgba(255,255,255,0.06);
          padding: 1px 5px;
          border-radius: 3px;
          font-size: 12px;
          color: hsl(30, 100%, 60%);
        }
        .wp-link {
          color: hsl(30, 100%, 50%);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .wp-link:hover { color: hsl(30, 100%, 65%); }
        .wp-table {
          width: 100%;
          border-collapse: collapse;
          margin: 12px 0;
          font-size: 12px;
        }
        .wp-table th, .wp-table td {
          border: 1px solid rgba(255,255,255,0.08);
          padding: 8px 12px;
          text-align: left;
        }
        .wp-table th {
          background: rgba(255,255,255,0.04);
          font-weight: 600;
          color: #fff;
        }
      `}</style>
    </div>
  );
}
