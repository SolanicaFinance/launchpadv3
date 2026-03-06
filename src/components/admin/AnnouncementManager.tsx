import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Megaphone, RefreshCw, X } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  description: string | null;
  action_label: string | null;
  action_url: string | null;
  emoji: string | null;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

const DEFAULT_PAGES = [
  "/", "/trending", "/trade", "/agents", "/punch", "/panel",
  "/discover", "/alpha-tracker", "/api", "/sdk", "/whitepaper",
];

export function AnnouncementManager() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [disabledPages, setDisabledPages] = useState<string[]>([]);
  const [newPage, setNewPage] = useState("");
  const { toast } = useToast();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("📢");
  const [actionLabel, setActionLabel] = useState("");
  const [actionUrl, setActionUrl] = useState("");

  useEffect(() => {
    loadAnnouncements();
    try {
      setDisabledPages(JSON.parse(localStorage.getItem("announcement-disabled-pages") || "[]"));
    } catch { /* ignore */ }
  }, []);

  const loadAnnouncements = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error) setAnnouncements(data || []);
    setLoading(false);
  };

  const toggleActive = async (id: string, currentState: boolean) => {
    await supabase.from("announcements").update({ is_active: !currentState }).eq("id", id);
    setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, is_active: !currentState } : a));
  };

  const deleteAnnouncement = async (id: string) => {
    await supabase.from("announcements").delete().eq("id", id);
    setAnnouncements(prev => prev.filter(a => a.id !== id));
    toast({ title: "Deleted" });
  };

  const createAnnouncement = async () => {
    if (!title.trim()) return;
    const { error } = await supabase.from("announcements").insert({
      title: title.trim(),
      description: description.trim() || null,
      emoji: emoji.trim() || null,
      action_label: actionLabel.trim() || null,
      action_url: actionUrl.trim() || null,
      is_active: true,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Created!" });
      setTitle(""); setDescription(""); setEmoji("📢"); setActionLabel(""); setActionUrl("");
      setShowForm(false);
      loadAnnouncements();
    }
  };

  const clearSeenCache = () => {
    localStorage.removeItem("seen-announcements");
    toast({ title: "Cleared", description: "Seen announcements cache cleared. Refresh to see them again." });
  };

  const togglePageDisable = (page: string) => {
    setDisabledPages(prev => {
      const next = prev.includes(page) ? prev.filter(p => p !== page) : [...prev, page];
      localStorage.setItem("announcement-disabled-pages", JSON.stringify(next));
      return next;
    });
  };

  const addCustomPage = () => {
    if (!newPage.trim() || !newPage.startsWith("/")) return;
    togglePageDisable(newPage.trim());
    setNewPage("");
  };

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-2" /> New Announcement
        </Button>
        <Button variant="outline" onClick={loadAnnouncements} disabled={loading}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
        <Button variant="secondary" onClick={clearSeenCache}>
          Clear Seen Cache
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-lg">New Announcement</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Title *</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="What's new?" />
              </div>
              <div>
                <Label>Emoji</Label>
                <Input value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="📢" className="w-20" />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional details" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Action Label</Label>
                <Input value={actionLabel} onChange={e => setActionLabel(e.target.value)} placeholder="Check it out" />
              </div>
              <div>
                <Label>Action URL</Label>
                <Input value={actionUrl} onChange={e => setActionUrl(e.target.value)} placeholder="/agents or https://..." />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={createAnnouncement} disabled={!title.trim()}>Create</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Announcements Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5" />
            Announcements ({announcements.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Active</TableHead>
                  <TableHead>Emoji</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {announcements.map(a => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Switch checked={a.is_active} onCheckedChange={() => toggleActive(a.id, a.is_active)} />
                    </TableCell>
                    <TableCell className="text-lg">{a.emoji || "📢"}</TableCell>
                    <TableCell>
                      <div className="font-medium">{a.title}</div>
                      {a.description && <div className="text-xs text-muted-foreground">{a.description}</div>}
                    </TableCell>
                    <TableCell>
                      {a.action_label ? (
                        <Badge variant="secondary">{a.action_label} → {a.action_url}</Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteAnnouncement(a.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {announcements.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No announcements yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Page Toggle Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Page Visibility Toggles</CardTitle>
          <p className="text-sm text-muted-foreground">
            Disable announcement popups on specific pages. Changes apply via localStorage.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {DEFAULT_PAGES.map(page => (
              <Badge
                key={page}
                variant={disabledPages.includes(page) ? "destructive" : "secondary"}
                className="cursor-pointer px-3 py-1.5"
                onClick={() => togglePageDisable(page)}
              >
                {page}
                {disabledPages.includes(page) && <X className="w-3 h-3 ml-1" />}
              </Badge>
            ))}
            {disabledPages.filter(p => !DEFAULT_PAGES.includes(p)).map(page => (
              <Badge
                key={page}
                variant="destructive"
                className="cursor-pointer px-3 py-1.5"
                onClick={() => togglePageDisable(page)}
              >
                {page} <X className="w-3 h-3 ml-1" />
              </Badge>
            ))}
          </div>
          <div className="flex gap-2 max-w-sm">
            <Input
              value={newPage}
              onChange={e => setNewPage(e.target.value)}
              placeholder="/custom-page"
              onKeyDown={e => e.key === "Enter" && addCustomPage()}
            />
            <Button variant="outline" size="sm" onClick={addCustomPage}>Add</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Click a page badge to toggle. Red = disabled (no popups). Click again to re-enable.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
