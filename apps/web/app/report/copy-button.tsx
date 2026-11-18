"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({ text }: { readonly text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      aria-label={copied ? "Copied" : "Copy message"}
      className="shrink-0"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      size="sm"
      type="button"
      variant="ghost"
    >
      {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
      <span className="font-normal text-sm">{copied ? "Copied" : "Copy"}</span>
    </Button>
  );
}
