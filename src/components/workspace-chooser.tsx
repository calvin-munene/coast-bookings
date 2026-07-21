"use client";

import { useOrganizationList } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type WorkspaceOption = Readonly<{ clerkOrganizationId: string; label: string; destination: string }>;

export function WorkspaceChooser({ options, autoActivate }: Readonly<{ options: readonly WorkspaceOption[]; autoActivate?: string }>) {
  const { setActive, isLoaded } = useOrganizationList();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const autoActivationStarted = useRef(false);

  async function activate(option: WorkspaceOption) {
    if (!setActive) return;
    setBusy(option.clerkOrganizationId);
    await setActive({ organization: option.clerkOrganizationId });
    router.replace(option.destination);
  }

  useEffect(() => {
    if (!isLoaded || !autoActivate || !setActive || autoActivationStarted.current) return;
    const option = options.find((item) => item.clerkOrganizationId === autoActivate);
    if (!option) return;
    autoActivationStarted.current = true;
    void setActive({ organization: option.clerkOrganizationId }).then(() => router.replace(option.destination));
  }, [isLoaded, autoActivate, options, router, setActive]);

  return <div className="workspace-options">{options.map((option) => <button className="workspace-option" type="button" key={option.clerkOrganizationId} disabled={busy !== null} onClick={() => void activate(option)}><strong>{option.label}</strong><span>{busy === option.clerkOrganizationId ? "Opening…" : "Open workspace"}</span></button>)}</div>;
}
