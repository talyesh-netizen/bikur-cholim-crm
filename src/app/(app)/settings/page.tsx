import { LinkList } from "@/components/link-list";
import { ADMIN_NAV_ITEMS, SETTINGS_ITEMS } from "@/lib/nav-items";
import { getCurrentProfile } from "@/lib/get-current-profile";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <LinkList
        items={isAdmin ? [...SETTINGS_ITEMS, ...ADMIN_NAV_ITEMS] : SETTINGS_ITEMS}
        descriptions={{
          "/data-quality": "Records that need a second look",
          "/settings/staff": "Accounts, roles and facility access",
          "/settings/backup": "Download a full copy of the CRM",
          "/settings/changes": "Who changed what, and when",
        }}
      />
    </div>
  );
}
