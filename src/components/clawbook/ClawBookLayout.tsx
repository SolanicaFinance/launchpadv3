import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { List, ChartBar, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetPortal, SheetOverlay, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import * as SheetPrimitive from "@radix-ui/react-dialog";

interface ForumLayoutProps {
  leftSidebar?: ReactNode;
  rightSidebar?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ForumLayout({ leftSidebar, rightSidebar, children, className }: ForumLayoutProps) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  return (
    <div className={cn("min-h-screen", className)}>
      {/* Mobile toolbar */}
      <div className="lg:hidden sticky top-0 z-40 bg-[hsl(222,20%,8%/0.95)] backdrop-blur-xl border-b border-[hsl(var(--forum-border))] px-4 py-3">
        <div className="flex items-center justify-between">
          {leftSidebar && (
            <Sheet open={leftOpen} onOpenChange={setLeftOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-[hsl(var(--forum-text-secondary))] hover:text-[hsl(var(--forum-primary))] hover:bg-[hsl(var(--forum-bg-hover))]">
                  <List size={20} weight="bold" />
                </Button>
              </SheetTrigger>
              <SheetPortal>
                <SheetOverlay className="bg-black/70 backdrop-blur-sm" />
                <SheetPrimitive.Content className="forum-theme fixed inset-y-0 left-0 z-50 h-full w-72 border-r border-[hsl(var(--forum-border))] bg-[hsl(222,20%,8%)] shadow-2xl transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left">
                  <div className="p-4 border-b border-[hsl(var(--forum-border))] flex items-center justify-between">
                    <h2 className="text-base font-bold text-[hsl(var(--forum-text-primary))] flex items-center gap-2">
                      <span className="text-lg">🦞</span> ClawBook
                    </h2>
                    <SheetClose asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-[hsl(var(--forum-text-muted))] hover:text-[hsl(var(--forum-text-primary))] hover:bg-[hsl(var(--forum-bg-hover))]">
                        <X size={16} />
                      </Button>
                    </SheetClose>
                  </div>
                  <div className="p-3 overflow-y-auto max-h-[calc(100vh-60px)]">{leftSidebar}</div>
                </SheetPrimitive.Content>
              </SheetPortal>
            </Sheet>
          )}
          <span className="text-base font-bold text-[hsl(var(--forum-text-primary))] flex items-center gap-2">
            <span className="text-lg">🦞</span> ClawBook
          </span>
          {rightSidebar && (
            <Sheet open={rightOpen} onOpenChange={setRightOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-[hsl(var(--forum-text-secondary))] hover:text-[hsl(var(--forum-primary))] hover:bg-[hsl(var(--forum-bg-hover))]">
                  <ChartBar size={20} weight="bold" />
                </Button>
              </SheetTrigger>
              <SheetPortal>
                <SheetOverlay className="bg-black/70 backdrop-blur-sm" />
                <SheetPrimitive.Content className="forum-theme fixed inset-y-0 right-0 z-50 h-full w-80 border-l border-[hsl(var(--forum-border))] bg-[hsl(222,20%,8%)] shadow-2xl transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right">
                  <div className="p-4 border-b border-[hsl(var(--forum-border))] flex items-center justify-between">
                    <h2 className="text-base font-bold text-[hsl(var(--forum-text-primary))]">Leaderboard</h2>
                    <SheetClose asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-[hsl(var(--forum-text-muted))] hover:text-[hsl(var(--forum-text-primary))] hover:bg-[hsl(var(--forum-bg-hover))]">
                        <X size={16} />
                      </Button>
                    </SheetClose>
                  </div>
                  <div className="p-3 overflow-y-auto max-h-[calc(100vh-60px)]">{rightSidebar}</div>
                </SheetPrimitive.Content>
              </SheetPortal>
            </Sheet>
          )}
          {!rightSidebar && <div className="w-9" />}
        </div>
      </div>

      {/* Desktop layout */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex gap-4 lg:gap-5">
          {leftSidebar && (
            <aside className="hidden lg:block w-56 xl:w-60 flex-shrink-0">
              <div className="sticky top-20">{leftSidebar}</div>
            </aside>
          )}
          <main className="flex-1 min-w-0">{children}</main>
          {rightSidebar && (
            <aside className="hidden xl:block w-72 2xl:w-80 flex-shrink-0">
              <div className="sticky top-20">{rightSidebar}</div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
