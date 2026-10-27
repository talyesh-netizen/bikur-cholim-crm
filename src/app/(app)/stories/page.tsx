import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoryList } from "@/components/story-list";
import { listStories } from "@/lib/queries/stories";

/** Stories (director, Oct 27, 2026): a simple free-form log of something
 * meaningful. Kept apart from interactions, so nothing here counts in
 * any report. */
export default async function StoriesPage() {
  const stories = await listStories();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Stories</h1>
          <p className="text-sm text-muted-foreground">Something meaningful, in your own words. Not counted in any report.</p>
        </div>
        <Button asChild>
          <Link href="/stories/new">
            <Plus className="size-4" />
            New story
          </Link>
        </Button>
      </div>
      <StoryList stories={stories} back="/stories" />
    </div>
  );
}
