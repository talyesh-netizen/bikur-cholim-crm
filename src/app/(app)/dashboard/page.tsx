import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          A quick summary of facilities, residents, visits, and follow-ups.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coming soon</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          You&apos;re signed in — the app shell (navigation, sign-in, and sign-out)
          is working. The real dashboard summary is built in a later stage,
          once facilities, residents, visits, and tasks exist to summarize.
        </CardContent>
      </Card>
    </div>
  );
}
