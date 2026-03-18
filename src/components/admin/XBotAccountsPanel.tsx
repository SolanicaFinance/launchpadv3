import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Edit, Trash2, Eye, Settings, AlertTriangle, Link2 } from "lucide-react";
import type { XBotAccountWithRules } from "@/hooks/useXBotAccounts";

interface XBotAccountsPanelProps {
  accounts: XBotAccountWithRules[];
  onAddAccount: () => void;
  onEditAccount: (account: XBotAccountWithRules) => void;
  onEditRules: (account: XBotAccountWithRules) => void;
  onDeleteAccount: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  onViewActivity: (account: XBotAccountWithRules) => void;
}

export function XBotAccountsPanel({
  accounts,
  onAddAccount,
  onEditAccount,
  onEditRules,
  onDeleteAccount,
  onToggleActive,
  onViewActivity,
}: XBotAccountsPanelProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await onDeleteAccount(id);
    setDeletingId(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Check for accounts with missing SOCKS5 proxies
  const accountsWithSocks5Issues = accounts.filter(
    (a) => a.is_active && (!a.socks5_urls || a.socks5_urls.length === 0)
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Bot Accounts</CardTitle>
        <Button onClick={onAddAccount} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {accountsWithSocks5Issues.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>SOCKS5 Warning:</strong> {accountsWithSocks5Issues.length} active account(s) have missing or expired SOCKS5 proxies.
              Please update: {accountsWithSocks5Issues.map((a) => `@${a.username}`).join(", ")}
            </AlertDescription>
          </Alert>
        )}
        {accounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No accounts configured. Click "Add Account" to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rules</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{account.name}</span>
                      <span className="text-sm text-muted-foreground">
                        @{account.username}
                      </span>
                      {account.subtuna_ticker && (
                        <span className="flex items-center gap-1 text-xs text-primary mt-0.5">
                          <Link2 className="h-3 w-3" />
                          t/{account.subtuna_ticker}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={account.is_active}
                        onCheckedChange={(checked) =>
                          onToggleActive(account.id, checked)
                        }
                      />
                      <Badge
                        variant={account.is_active ? "default" : "secondary"}
                      >
                        {account.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {account.rules?.monitored_mentions?.length ? (
                        <Badge variant="outline" className="text-xs">
                          {account.rules.monitored_mentions.length} mentions
                        </Badge>
                      ) : null}
                      {account.rules?.tracked_cashtags?.length ? (
                        <Badge variant="outline" className="text-xs">
                          {account.rules.tracked_cashtags.length} cashtags
                        </Badge>
                      ) : null}
                      <Badge variant="outline" className="text-xs">
                        {account.rules?.min_follower_count?.toLocaleString() || 5000}+ followers
                      </Badge>
                      {account.has_full_cookie ? (
                        <Badge variant="outline" className="text-xs">
                          Cookies saved
                        </Badge>
                      ) : null}
                      {account.socks5_urls?.length ? (
                        <Badge variant="outline" className="text-xs">
                          {account.socks5_urls.length} SOCKS5
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(account.updated_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewActivity(account)}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Activity
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEditAccount(account)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Account
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEditRules(account)}>
                          <Settings className="w-4 h-4 mr-2" />
                          Edit Rules
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(account.id)}
                          disabled={deletingId === account.id}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
