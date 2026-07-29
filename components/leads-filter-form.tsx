import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "closed", label: "Closed" },
];

export function LeadsFilterForm({
  engineerOptions,
  currentFilters,
}: {
  engineerOptions: { id: string; fullName: string }[];
  currentFilters: {
    engineerId?: string;
    status?: string;
    from?: string;
    to?: string;
  };
}) {
  const hasAnyFilter = Boolean(
    currentFilters.engineerId || currentFilters.status || currentFilters.from || currentFilters.to,
  );

  return (
    <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="engineerId">Engineer</Label>
        <Select
          name="engineerId"
          defaultValue={currentFilters.engineerId ?? "all"}
          items={[
            { value: "all", label: "All engineers" },
            ...engineerOptions.map((engineer) => ({ value: engineer.id, label: engineer.fullName })),
          ]}
        >
          <SelectTrigger id="engineerId" className="w-48">
            <SelectValue placeholder="All engineers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All engineers</SelectItem>
            {engineerOptions.map((engineer) => (
              <SelectItem key={engineer.id} value={engineer.id}>
                {engineer.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="status">Status</Label>
        <Select
          name="status"
          defaultValue={currentFilters.status ?? "all"}
          items={[{ value: "all", label: "All statuses" }, ...STATUS_OPTIONS]}
        >
          <SelectTrigger id="status" className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="from">Applied from</Label>
        <Input id="from" name="from" type="date" defaultValue={currentFilters.from} className="w-40" />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="to">Applied to</Label>
        <Input id="to" name="to" type="date" defaultValue={currentFilters.to} className="w-40" />
      </div>

      <Button type="submit" size="sm">
        Filter
      </Button>
      {hasAnyFilter && (
        <Button variant="outline" size="sm" render={<Link href="/leads" />} nativeButton={false}>
          Clear
        </Button>
      )}
    </form>
  );
}
