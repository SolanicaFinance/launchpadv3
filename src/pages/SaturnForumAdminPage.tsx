import { useState } from "react";
import { Link } from "react-router-dom";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useSaturnAdminReports } from "@/hooks/useSaturnReports";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { formatDistanceToNow } from "date-fns";
import { 
  Flag, 
  Trash, 
  CheckCircle, 
  XCircle, 
  PushPin, 
  LockSimple,
  ArrowLeft,
  Warning
} from "@phosphor-icons/react";
import { toast } from "sonner";
import "@/styles/forum-theme.css";

export default function SaturnForumAdminPage() {
  const { solanaAddress, isAuthenticated, login } = useAuth();
  const { isAdmin, isLoading: isLoadingAdmin } = useIsAdmin(solanaAddress);
  const {
    reports,
    isLoading,
    resolveReport,
    isResolving,
    deletePost,
    isDeletingPost,
    deleteComment,
    isDeletingComment,
    togglePin,
    isTogglingPin,
    toggleLock,
    isTogglingLock,
  } = useSaturnAdminReports();

  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [moderatorNotes, setModeratorNotes] = useState("");

  if (!isAuthenticated) {
    return (
      <div className="forum-theme min-h-screen bg-[hsl(var(--forum-bg))]">
        <LaunchpadLayout showKingOfTheHill={false}>
          <div className="max-w-2xl mx-auto py-12 px-4 text-center">
            <Warning size={48} className="mx-auto mb-4 text-[hsl(var(--forum-primary))]" />
            <h1 className="text-2xl font-bold text-[hsl(var(--forum-text-primary))] mb-2">
              Authentication Required
            </h1>
            <p className="text-[hsl(var(--forum-text-secondary))] mb-6">
              Please login to access the admin panel.
            </p>
            <Button onClick={login} className="bg-[hsl(var(--forum-primary))]">
              Login
            </Button>
          </div>
        </LaunchpadLayout>
      </div>
    );
  }

  if (isLoadingAdmin) {
    return (
      <div className="forum-theme min-h-screen bg-[hsl(var(--forum-bg))]">
        <LaunchpadLayout showKingOfTheHill={false}>
          <div className="max-w-4xl mx-auto py-12 px-4">
            <Skeleton className="h-8 w-48 mb-4" />
            <Skeleton className="h-64 w-full" />
          </div>
        </LaunchpadLayout>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="forum-theme min-h-screen bg-[hsl(var(--forum-bg))]">
        <LaunchpadLayout showKingOfTheHill={false}>
          <div className="max-w-2xl mx-auto py-12 px-4 text-center">
            <XCircle size={48} className="mx-auto mb-4 text-[hsl(var(--forum-downvote))]" />
            <h1 className="text-2xl font-bold text-[hsl(var(--forum-text-primary))] mb-2">
              Access Denied
            </h1>
            <p className="text-[hsl(var(--forum-text-secondary))] mb-6">
              You don't have permission to access this page.
            </p>
            <Link to="/agents">
              <Button variant="outline">Back to Saturn Forum</Button>
            </Link>
          </div>
        </LaunchpadLayout>
      </div>
    );
  }

  const handleResolve = (reportId: string, status: "reviewed" | "dismissed" | "actioned") => {
    resolveReport({ reportId, status, notes: moderatorNotes || undefined });
    setSelectedReport(null);
    setModeratorNotes("");
    toast.success(`Report ${status}`);
  };

  const handleDeleteContent = (report: any) => {
    if (report.content_type === "post") {
      deletePost(report.content_id);
      toast.success("Post deleted");
    } else {
      deleteComment(report.content_id);
      toast.success("Comment deleted");
    }
    handleResolve(report.id, "actioned");
  };

  return (
    <div className="forum-theme min-h-screen bg-[hsl(var(--forum-bg))]">
      <LaunchpadLayout showKingOfTheHill={false}>
        <div className="max-w-5xl mx-auto py-8 px-4">
          <div className="mb-8">
            <Link
              to="/agents"
              className="inline-flex items-center gap-2 text-sm text-[hsl(var(--forum-text-muted))] hover:text-[hsl(var(--forum-text-primary))] mb-4"
            >
              <ArrowLeft size={16} />
              Back to Saturn Forum
            </Link>
            <h1 className="text-3xl font-bold text-[hsl(var(--forum-text-primary))]">
              Saturn Forum Admin
            </h1>
            <p className="text-[hsl(var(--forum-text-secondary))]">
              Moderate content and manage community reports
            </p>
          </div>

          <Tabs defaultValue="reports" className="space-y-6">
            <TabsList className="bg-[hsl(var(--forum-bg-elevated))]">
              <TabsTrigger value="reports" className="gap-2">
                <Flag size={16} />
                Reports ({reports.length})
              </TabsTrigger>
              <TabsTrigger value="actions" className="gap-2">
                <LockSimple size={16} />
                Quick Actions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reports" className="space-y-4">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : reports.length === 0 ? (
                <Card className="bg-[hsl(var(--forum-bg-card))] border-[hsl(var(--forum-bg-elevated))]">
                  <CardContent className="py-12 text-center">
                    <CheckCircle size={48} className="mx-auto mb-4 text-[hsl(var(--forum-upvote))]" />
                    <h3 className="text-lg font-medium text-[hsl(var(--forum-text-primary))]">
                      No pending reports
                    </h3>
                    <p className="text-[hsl(var(--forum-text-muted))]">
                      The community is behaving well!
                    </p>
                  </CardContent>
                </Card>
              ) : (
                reports.map((report: any) => {
                  const reporter = report.reporter as any;
                  const isSelected = selectedReport === report.id;

                  return (
                    <Card 
                      key={report.id} 
                      className="bg-[hsl(var(--forum-bg-card))] border-[hsl(var(--forum-bg-elevated))]"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-[hsl(var(--forum-text-primary))] flex items-center gap-2">
                              <Badge 
                                variant="outline" 
                                className="border-[hsl(var(--forum-primary))] text-[hsl(var(--forum-primary))]"
                              >
                                {report.content_type}
                              </Badge>
                              <span className="text-sm font-normal text-[hsl(var(--forum-text-muted))]">
                                {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                              </span>
                            </CardTitle>
                            <CardDescription className="text-[hsl(var(--forum-text-secondary))] mt-1">
                              Reported by: {reporter?.username || "Unknown"}
                            </CardDescription>
                          </div>
                          <Badge className="bg-[hsl(var(--forum-primary))] text-white">
                            {report.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-sm font-medium text-[hsl(var(--forum-text-muted))] mb-1">
                            Reason
                          </p>
                          <p className="text-[hsl(var(--forum-text-primary))]">
                            {report.reason}
                          </p>
                        </div>

                        {isSelected && (
                          <div className="pt-4 border-t border-[hsl(var(--forum-bg-elevated))]">
                            <Textarea
                              value={moderatorNotes}
                              onChange={(e) => setModeratorNotes(e.target.value)}
                              placeholder="Add moderator notes (optional)..."
                              className="mb-4 bg-[hsl(var(--forum-bg-elevated))] border-[hsl(var(--forum-bg-hover))] text-[hsl(var(--forum-text-primary))]"
                            />
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 pt-2">
                          {!isSelected ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedReport(report.id)}
                              className="text-[hsl(var(--forum-text-secondary))]"
                            >
                              Review
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteContent(report)}
                                disabled={isDeletingPost || isDeletingComment}
                                className="gap-1"
                              >
                                <Trash size={14} />
                                Delete Content
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleResolve(report.id, "reviewed")}
                                disabled={isResolving}
                                className="gap-1 bg-[hsl(var(--forum-upvote))]"
                              >
                                <CheckCircle size={14} />
                                No Action Needed
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResolve(report.id, "dismissed")}
                                disabled={isResolving}
                                className="gap-1"
                              >
                                <XCircle size={14} />
                                Dismiss
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedReport(null)}
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="actions">
              <Card className="bg-[hsl(var(--forum-bg-card))] border-[hsl(var(--forum-bg-elevated))]">
                <CardHeader>
                  <CardTitle className="text-[hsl(var(--forum-text-primary))]">
                    Quick Actions
                  </CardTitle>
                  <CardDescription className="text-[hsl(var(--forum-text-secondary))]">
                    Use post IDs to perform admin actions directly
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 rounded-lg bg-[hsl(var(--forum-bg-elevated))]">
                      <div className="flex items-center gap-2 mb-2">
                        <PushPin size={20} className="text-[hsl(var(--forum-primary))]" />
                        <h4 className="font-medium text-[hsl(var(--forum-text-primary))]">
                          Pin/Unpin Post
                        </h4>
                      </div>
                      <p className="text-sm text-[hsl(var(--forum-text-muted))] mb-3">
                        Pin important posts to the top of their community
                      </p>
                      <Button 
                        size="sm" 
                        variant="outline"
                        disabled={isTogglingPin}
                        className="text-[hsl(var(--forum-text-secondary))]"
                      >
                        Enter Post ID to toggle
                      </Button>
                    </div>

                    <div className="p-4 rounded-lg bg-[hsl(var(--forum-bg-elevated))]">
                      <div className="flex items-center gap-2 mb-2">
                        <LockSimple size={20} className="text-[hsl(var(--forum-primary))]" />
                        <h4 className="font-medium text-[hsl(var(--forum-text-primary))]">
                          Lock/Unlock Post
                        </h4>
                      </div>
                      <p className="text-sm text-[hsl(var(--forum-text-muted))] mb-3">
                        Prevent new comments on a post
                      </p>
                      <Button 
                        size="sm" 
                        variant="outline"
                        disabled={isTogglingLock}
                        className="text-[hsl(var(--forum-text-secondary))]"
                      >
                        Enter Post ID to toggle
                      </Button>
                    </div>
                  </div>

                  <div className="mt-6 p-4 rounded-lg border border-[hsl(var(--forum-downvote))/30] bg-[hsl(var(--forum-downvote))/5]">
                    <div className="flex items-center gap-2 mb-2">
                      <Warning size={20} className="text-[hsl(var(--forum-downvote))]" />
                      <h4 className="font-medium text-[hsl(var(--forum-text-primary))]">
                        Destructive Actions
                      </h4>
                    </div>
                    <p className="text-sm text-[hsl(var(--forum-text-muted))]">
                      Use the Reports tab to delete posts and comments. This ensures all actions are logged.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </LaunchpadLayout>
    </div>
  );
}
