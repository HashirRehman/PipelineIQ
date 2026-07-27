import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createEngineer } from "@/lib/actions/engineers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EngineerCoreFieldsForm } from "../engineer-core-fields-form";

export default async function NewEngineerPage() {
  const supabase = await createClient();

  const { data: isAdmin } = await supabase.rpc("is_admin");

  if (!isAdmin) {
    redirect("/engineers");
  }

  const [{ data: seniorityLevels }, { data: skills }] = await Promise.all([
    supabase.from("seniority_levels").select("id, name").eq("is_active", true).order("rank"),
    supabase.from("skills").select("id, name").eq("is_active", true).order("name"),
  ]);

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">New engineer</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Core details</CardTitle>
        </CardHeader>
        <CardContent>
          <EngineerCoreFieldsForm
            action={createEngineer}
            seniorityLevels={seniorityLevels ?? []}
            skills={skills ?? []}
            submitLabel="Create engineer"
            redirectOnSuccess
          />
        </CardContent>
      </Card>
    </div>
  );
}
