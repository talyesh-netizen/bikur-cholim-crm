"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InteractionWithNames } from "@/lib/domain/interaction";
import type { FacilityMedia, MediaUsageScope } from "@/lib/queries/facility-media";
import { MEDIA_USAGE_SCOPES } from "@/lib/queries/facility-media";
import { formatDateTime } from "@/lib/format-date";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

async function sha256Hex(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function extensionFor(file: File) {
  const byType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  return byType[file.type] ?? "img";
}

export function FacilityMediaCard({
  facilityId,
  media,
  interactions,
}: {
  facilityId: string;
  media: FacilityMedia[];
  interactions: InteractionWithNames[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [files, setFiles] = useState<File[]>([]);
  const [interactionId, setInteractionId] = useState("");
  const [caption, setCaption] = useState("");
  const [usageScope, setUsageScope] = useState<MediaUsageScope>("internal_only");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upload() {
    if (!files.length) return;
    setSaving(true);
    setMessage(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      setMessage("Your session expired. Please sign in again.");
      setSaving(false);
      return;
    }

    let saved = 0;
    let duplicates = 0;

    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) {
        setMessage(`${file.name}: please choose a JPG, PNG, WebP, HEIC or HEIF image.`);
        setSaving(false);
        return;
      }
      if (file.size > MAX_BYTES) {
        setMessage(`${file.name}: image is larger than 10 MB.`);
        setSaving(false);
        return;
      }

      const sha256 = await sha256Hex(file);
      const { data: existing, error: duplicateCheckError } = await supabase
        .from("facility_media")
        .select("id")
        .eq("facility_id", facilityId)
        .eq("sha256", sha256)
        .maybeSingle();

      if (duplicateCheckError) {
        setMessage(duplicateCheckError.message);
        setSaving(false);
        return;
      }
      if (existing) {
        duplicates += 1;
        continue;
      }

      const storagePath = `${facilityId}/${crypto.randomUUID()}.${extensionFor(file)}`;
      const { error: uploadError } = await supabase.storage
        .from("impact-media")
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        setMessage(uploadError.message);
        setSaving(false);
        return;
      }

      const { error: insertError } = await supabase.from("facility_media").insert({
        facility_id: facilityId,
        interaction_id: interactionId || null,
        storage_path: storagePath,
        original_filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        sha256,
        caption: caption.trim() || null,
        usage_scope: usageScope,
        created_by: user.id,
      });

      if (insertError) {
        await supabase.storage.from("impact-media").remove([storagePath]);
        if (insertError.code === "23505") {
          duplicates += 1;
          continue;
        }
        setMessage(insertError.message);
        setSaving(false);
        return;
      }
      saved += 1;
    }

    setFiles([]);
    setCaption("");
    const parts = [];
    if (saved) parts.push(`${saved} photo${saved === 1 ? "" : "s"} saved`);
    if (duplicates) parts.push(`${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped`);
    setMessage(parts.join(". ") + ".");
    setSaving(false);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Impact photos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-lg border border-dashed p-3">
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium">
              Add photos
              <input
                className="mt-1 block w-full text-sm"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
              />
            </label>
            <label className="text-sm">
              Program or interaction <span className="text-muted-foreground">(optional)</span>
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={interactionId}
                onChange={(event) => setInteractionId(event.target.value)}
              >
                <option value="">Facility only</option>
                {interactions.map((interaction) => (
                  <option key={interaction.id} value={interaction.id}>
                    {formatDateTime(interaction.occurred_at) ?? "Interaction"} · {interaction.interaction_type.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Caption <span className="text-muted-foreground">(optional)</span>
              <input
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="What is happening in these photos?"
              />
            </label>
            <label className="text-sm">
              Photo permission
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={usageScope}
                onChange={(event) => setUsageScope(event.target.value as MediaUsageScope)}
              >
                {MEDIA_USAGE_SCOPES.map((scope) => (
                  <option key={scope.value} value={scope.value}>{scope.label}</option>
                ))}
              </select>
            </label>
            <p className="text-xs text-muted-foreground">
              New photos default to Internal only. Duplicate photos at this facility are skipped automatically.
            </p>
            <Button type="button" onClick={upload} disabled={!files.length || saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
              {saving ? "Saving…" : `Save ${files.length || ""} photo${files.length === 1 ? "" : "s"}`}
            </Button>
            {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}
          </div>
        </div>

        {media.length === 0 ? (
          <p className="text-sm text-muted-foreground">No photos attached to this facility yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {media.map((item) => (
              <figure key={item.id} className="overflow-hidden rounded-lg border bg-muted/30">
                {item.signed_url ? (
                  <a href={item.signed_url} target="_blank" rel="noreferrer">
                    {/* Storage URLs expire quickly and are private; a plain img avoids remote-image host configuration. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.signed_url} alt={item.caption || "Facility impact photo"} className="aspect-square w-full object-cover" />
                  </a>
                ) : (
                  <div className="flex aspect-square items-center justify-center text-xs text-muted-foreground">Preview unavailable</div>
                )}
                <figcaption className="flex flex-col gap-1 p-2 text-xs">
                  {item.caption ? <span>{item.caption}</span> : null}
                  <span className="text-muted-foreground">
                    {MEDIA_USAGE_SCOPES.find((scope) => scope.value === item.usage_scope)?.label}
                  </span>
                  {item.interaction ? (
                    <span className="text-muted-foreground">{formatDateTime(item.interaction.occurred_at)}</span>
                  ) : null}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
