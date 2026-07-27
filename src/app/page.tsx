import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-6">
      <Badge variant="secondary">Phase One &middot; Under construction</Badge>

      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Resident Support Services</CardTitle>
          <CardDescription>
            Internal tool for the Bikur Cholim of Cleveland Senior Living Resident
            Support Services department.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
          <p>
            This is the project scaffold — the visual foundation (warm colors,
            fonts, and reusable components) that every screen will be built on
            top of. Sign-in, the dashboard, and the rest of Phase One are still
            being built.
          </p>
          <Button className="w-fit" disabled>
            Sign in (coming soon)
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
