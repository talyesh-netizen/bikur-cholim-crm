import { redirect } from "next/navigation";

export default function Home() {
  // The middleware already guarantees only signed-in users reach this
  // point (anyone signed out is redirected to /sign-in before this page
  // ever renders), so this is just a landing spot that sends everyone
  // straight to the dashboard.
  redirect("/dashboard");
}
