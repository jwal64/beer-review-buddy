import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Beer } from "@/lib/beer-data";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { toast } from "sonner";

const STYLES = ["Lager", "Pilsner", "Wheat Beer", "Belgian Ale", "IPA", "Pale Ale", "Stout"];
const METHODS = ["Draft", "Bottle", "Can", "Nitro"];

export function BeerForm({
  open,
  onOpenChange,
  beer,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beer?: Beer | null;
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const editing = !!beer;

  const [form, setForm] = useState({
    name: beer?.name ?? "",
    brewery: beer?.brewery ?? "",
    style: beer?.style ?? "Lager",
    abv: beer?.abv != null ? String(beer.abv) : "",
    method: beer?.method ?? "Bottle",
    city: beer?.city ?? "",
    country: beer?.country ?? "",
    rating: beer ? String(beer.rating) : "",
    drank_on: beer?.drank_on ?? new Date().toISOString().slice(0, 10),
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const rating = Number(form.rating);
    if (!form.name.trim()) {
      toast.error("Beer name is required");
      return;
    }
    if (!(rating >= 0 && rating <= 5)) {
      toast.error("Rating must be between 0 and 5");
      return;
    }

    setBusy(true);
    const payload = {
      name: form.name.trim(),
      brewery: form.brewery.trim() || null,
      style: form.style,
      abv: form.abv ? Number(form.abv) : null,
      method: form.method,
      city: form.city.trim() || null,
      country: form.country.trim() || null,
      rating,
      drank_on: form.drank_on,
    };
    const { error } = editing
      ? await supabase.from("beers").update(payload).eq("id", beer.id)
      : await supabase.from("beers").insert(payload);
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Beer updated" : "Beer added");
    await queryClient.invalidateQueries({ queryKey: ["beers"] });
    onOpenChange(false);
  }

  async function handleDelete() {
    if (!beer) return;
    setBusy(true);
    const { error } = await supabase.from("beers").delete().eq("id", beer.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Beer deleted");
    await queryClient.invalidateQueries({ queryKey: ["beers"] });
    onOpenChange(false);
    onDeleted?.();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-display">
            {editing ? "Edit beer" : "Add a beer"}
          </SheetTitle>
          <SheetDescription>
            {editing ? "Update the details of this review." : "Log a new pour in seconds."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 pb-8">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="bf-name">Beer</Label>
              <Input
                id="bf-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Guinness"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="bf-brewery">Brewery</Label>
              <Input
                id="bf-brewery"
                value={form.brewery}
                onChange={(e) => set("brewery", e.target.value)}
                placeholder="e.g. Guinness"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Style</Label>
              <Select value={form.style} onValueChange={(v) => set("style", v)}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Served</Label>
              <Select value={form.method} onValueChange={(v) => set("method", v)}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bf-abv">ABV %</Label>
              <Input
                id="bf-abv"
                type="number"
                step="0.1"
                min="0"
                max="20"
                value={form.abv}
                onChange={(e) => set("abv", e.target.value)}
                placeholder="5.0"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bf-rating">Rating (0–5)</Label>
              <Input
                id="bf-rating"
                type="number"
                step="0.25"
                min="0"
                max="5"
                value={form.rating}
                onChange={(e) => set("rating", e.target.value)}
                placeholder="4.25"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bf-city">City</Label>
              <Input
                id="bf-city"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="New York"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bf-country">Country</Label>
              <Input
                id="bf-country"
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
                placeholder="USA"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="bf-date">Date</Label>
              <Input
                id="bf-date"
                type="date"
                value={form.drank_on}
                onChange={(e) => set("drank_on", e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
          </div>

          <Button type="submit" className="h-11 w-full rounded-xl" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Add beer"}
          </Button>
          {editing && (
            <Button
              type="button"
              variant="destructive"
              className="h-11 w-full rounded-xl"
              disabled={busy}
              onClick={handleDelete}
            >
              Delete this beer
            </Button>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}
