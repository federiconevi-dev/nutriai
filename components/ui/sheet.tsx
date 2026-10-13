"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Side panel built on the Radix dialog: slides in from the right on larger
 * screens and rises as a bottom sheet on phones.
 */
const Sheet = DialogPrimitive.Root;
const SheetTitle = DialogPrimitive.Title;
const SheetDescription = DialogPrimitive.Description;

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-fade-in" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 flex flex-col border-white/10 bg-card shadow-2xl outline-none",
        "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl border-t data-[state=open]:animate-sheet-up",
        "sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[440px] sm:rounded-none sm:rounded-l-3xl sm:border-l sm:border-t-0 sm:data-[state=open]:animate-sheet-left",
        className
      )}
      {...props}
    >
      <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-white/15 sm:hidden" />
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Cerrar</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = "SheetContent";

export { Sheet, SheetContent, SheetTitle, SheetDescription };
