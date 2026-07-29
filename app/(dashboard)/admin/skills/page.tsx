import { redirect } from "next/navigation";
import { createClient, getCachedIsAdmin } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { SkillCreateForm } from "./skill-create-form";
import { SkillActiveToggle } from "./skill-active-toggle";

export default async function AdminSkillsPage() {
  const supabase = await createClient();

  const isAdmin = await getCachedIsAdmin();

  if (!isAdmin) {
    redirect("/engineers");
  }

  const { data: skills } = await supabase
    .from("skills")
    .select("id, name, is_active")
    .order("name");

  const list = skills ?? [];

  return (
    <div className="mx-auto max-w-xl p-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Add a skill</CardTitle>
        </CardHeader>
        <CardContent>
          <SkillCreateForm />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">All skills</CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">No skills defined yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {list.map((skill) => (
                <li key={skill.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    {skill.name}
                    <StatusBadge variant={skill.is_active ? "success" : "neutral"}>
                      {skill.is_active ? "Active" : "Inactive"}
                    </StatusBadge>
                  </div>
                  <SkillActiveToggle skillId={skill.id} isActive={skill.is_active} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
