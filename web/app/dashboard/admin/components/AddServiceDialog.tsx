"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SystemService } from "@/lib/types";

const EMPTY_FORM = {
  service_name: "",
  dynatrace_entity_id: "",
  replacement_service_id: "",
  description: "",
  url: "",
};

export function AddServiceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (svc: SystemService) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [form, setForm]     = useState(EMPTY_FORM);

  function update(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = {
        service_name:           form.service_name.trim(),
        dynatrace_entity_id:    form.dynatrace_entity_id.trim(),
        replacement_service_id: form.replacement_service_id.trim() || null,
        description:            form.description.trim() || null,
        url:                    form.url.trim() || null,
      };
      const created = await apiFetch<SystemService>("/admin/system-services", {
        method: "POST",
        body: JSON.stringify(body),
      });
      onCreated(created);
      setForm(EMPTY_FORM);
    } catch (err: unknown) {
      setError((err as Error).message ?? "Failed to register service");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Register System Service</DialogTitle>
          <DialogDescription>
            Add a Karma infrastructure service for self-monitoring. Registering automatically
            starts learning and, once ready, begins haunting — no manual steps. The Dynatrace
            entity ID appears in the Services screen (SERVICE-…) once OTel traces are flowing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="svc-name">Service name *</Label>
            <Input
              id="svc-name"
              placeholder="Karma Agent System"
              value={form.service_name}
              onChange={(e) => update("service_name", e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-dt-id">Dynatrace entity ID *</Label>
            <Input
              id="svc-dt-id"
              placeholder="SERVICE-XXXXXXXXXXXXXXXXX"
              value={form.dynatrace_entity_id}
              onChange={(e) => update("dynatrace_entity_id", e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-repl-id">
              Replacement entity ID{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="svc-repl-id"
              placeholder="SERVICE-XXXXXXXXXXXXXXXXX"
              value={form.replacement_service_id}
              onChange={(e) => update("replacement_service_id", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-desc">
              Description{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="svc-desc"
              placeholder="Multi-agent coordinator — Learner, Watcher, Forensic"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-url">
              Service URL{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="svc-url"
              placeholder="https://karma-api-…run.app"
              value={form.url}
              onChange={(e) => update("url", e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? "Registering…" : "Register"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
