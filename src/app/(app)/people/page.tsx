import { LinkList } from "@/components/link-list";
import { PEOPLE_ITEMS } from "@/lib/nav-items";

export default function PeoplePage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">People</h1>
      <LinkList
        items={PEOPLE_ITEMS}
        descriptions={{
          "/contacts": "Family members, volunteers and facility staff",
          "/organizations": "Shuls, schools and community partners",
        }}
      />
    </div>
  );
}
