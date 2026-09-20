import { createClient } from "@/lib/supabase/server";

export type DataQualityRow = { id: string; label: string; href: string; missing: string };

export type DataQualityReport = {
  contactsMissingPhone: DataQualityRow[];
  contactsMissingEmail: DataQualityRow[];
  facilitiesMissingPhone: DataQualityRow[];
  facilitiesMissingAddress: DataQualityRow[];
  organizationsMissingPhone: DataQualityRow[];
};

/** Everything with a gap in its basic contact info -- active records
 * only, since an inactive/retired record's missing phone number isn't
 * anyone's problem to chase down. Each section links straight to the
 * record's edit page. */
export async function getDataQualityReport(): Promise<DataQualityReport> {
  const supabase = await createClient();

  const [contactsPhone, contactsEmail, facilitiesPhone, facilitiesAddress, organizationsPhone] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name")
      .eq("active", true)
      .or("phone.is.null,phone.eq.")
      .order("name"),
    supabase
      .from("contacts")
      .select("id, name")
      .eq("active", true)
      .or("email.is.null,email.eq.")
      .order("name"),
    supabase
      .from("facilities")
      .select("id, name")
      .eq("active", true)
      .or("main_phone.is.null,main_phone.eq.")
      .order("name"),
    supabase
      .from("facilities")
      .select("id, name")
      .eq("active", true)
      .or("address.is.null,address.eq.")
      .order("name"),
    supabase
      .from("organizations")
      .select("id, name")
      .eq("active", true)
      .or("main_phone.is.null,main_phone.eq.")
      .order("name"),
  ]);

  return {
    contactsMissingPhone: (contactsPhone.data ?? []).map((c) => ({
      id: c.id,
      label: c.name,
      href: `/contacts/${c.id}/edit`,
      missing: "phone",
    })),
    contactsMissingEmail: (contactsEmail.data ?? []).map((c) => ({
      id: c.id,
      label: c.name,
      href: `/contacts/${c.id}/edit`,
      missing: "email",
    })),
    facilitiesMissingPhone: (facilitiesPhone.data ?? []).map((f) => ({
      id: f.id,
      label: f.name,
      href: `/facilities/${f.id}/edit`,
      missing: "main phone",
    })),
    facilitiesMissingAddress: (facilitiesAddress.data ?? []).map((f) => ({
      id: f.id,
      label: f.name,
      href: `/facilities/${f.id}/edit`,
      missing: "address",
    })),
    organizationsMissingPhone: (organizationsPhone.data ?? []).map((o) => ({
      id: o.id,
      label: o.name,
      href: `/organizations/${o.id}/edit`,
      missing: "main phone",
    })),
  };
}
