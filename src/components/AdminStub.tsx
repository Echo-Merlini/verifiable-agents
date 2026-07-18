"use client";

import { Plug } from "lucide-react";

/**
 * Placeholder for admin sections that ship with the full ENS/dinamic kit but aren't
 * wired in this demo build. The menu slot is kept on purpose — plugging the section
 * back in = swapping this stub for the real page.
 */
export function AdminStub({ title, blurb }: { title: string; blurb?: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-100">{title}</h1>
      <div className="bg-gb-surface border border-gb-border rounded-xl p-10 text-center space-y-3">
        <div className="w-11 h-11 rounded-full bg-gb-input mx-auto flex items-center justify-center">
          <Plug className="w-5 h-5 text-gb-muted" />
        </div>
        <p className="text-sm text-slate-300 font-medium">Not enabled in this build</p>
        <p className="text-xs text-gb-muted max-w-sm mx-auto leading-relaxed">
          {blurb ?? "This section ships with the full kit. The slot is kept here — plug it in by swapping the stub for the real page."}
        </p>
      </div>
    </div>
  );
}
