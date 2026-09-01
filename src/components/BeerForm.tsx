// Adding a beer here is the only way a beer enters the log: this database is
// the source of truth, and the static site at jwal64/JWAL-BEER-REVIEW is
// generated from it.
//
// So the form has to capture everything that site renders, not just what this
// app shows. A review needs the brewery that made it (which is where its origin
// country comes from), the place it was drunk (city, region, country and code),
// and a domain to find its logo at. A beer saved without those is a beer that
// fails the site's data check and shows a placeholder — which is why the
// brewery and the place are pickers that can create what they don't find,
// rather than free text that silently invents a new spelling of "Antwerp".
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  type Beer,
  METHODS,
  STYLES,
  useBrandDomains,
  useBreweries,
  useCountries,
  useLocations,
} from "@/lib/beer-data";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// The sentinel a picker uses for "not in the list — let me add it".
const NEW = "__new";

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

  const { data: breweries = [] } = useBreweries();
  const { data: locations = [] } = useLocations();
  const { data: countries = [] } = useCountries();
  const { data: brandDomains } = useBrandDomains();

  const [form, setForm] = useState({
    name: beer?.name ?? "",
    brewery: beer?.brewery ?? "",
    style: beer?.style ?? "Lager",
    abv: beer?.abv != null ? String(beer.abv) : "",
    method: beer?.method ?? "Bottle",
    rating: beer ? String(beer.rating) : "",
    isNew: beer?.is_new ?? false,
    drank_on: beer?.drank_on ?? new Date().toISOString().slice(0, 10),
    // The place, held as the city of an existing location row.
    place: beer?.city ?? "",
    domain: "",
    // Only used when a picker is on "add new".
    newBrewery: { name: "", location: "", cc: "", lang: "", nativeName: "", lat: "", lng: "" },
    newPlace: { city: "", region: "", cc: "", lat: "", lng: "" },
  });

  type Form = typeof form;
  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function setNested<K extends "newBrewery" | "newPlace">(
    group: K,
    key: keyof Form[K],
    value: string,
  ) {
    setForm((f) => ({ ...f, [group]: { ...f[group], [key]: value } }));
  }

  const addingBrewery = form.brewery === NEW;
  const addingPlace = form.place === NEW;
  const knownDomain = brandDomains?.get(form.name.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const name = form.name.trim();
      const rating = Number(form.rating);
      const abv = Number(form.abv);

      if (!name) throw new Error("Beer name is required");
      if (!(rating >= 0 && rating <= 5)) throw new Error("Rating must be between 0 and 5");
      // The site stores ratings out of five in quarter steps, and the column
      // rejects anything else — better to say so here than to show a 400.
      if (Math.round(rating * 4) !== rating * 4)
        throw new Error("Rating goes in quarter steps — 3.25, 3.5, 3.75");
      if (!(abv > 0 && abv <= 20)) throw new Error("ABV must be a number between 0 and 20");

      // ── The brewery, created first if it is a new one. It carries the beer's
      // origin country, so the review cannot be written without it.
      let breweryName = form.brewery;
      if (addingBrewery) {
        const b = form.newBrewery;
        if (!b.name.trim()) throw new Error("The new brewery needs a name");
        if (!b.cc) throw new Error("The new brewery needs a country");
        if (!/^[a-z]{2}$/.test(b.lang.trim()))
          throw new Error("The new brewery needs a two-letter language code, like de or ja");
        const { error } = await supabase.from("breweries").insert({
          name: b.name.trim(),
          location: b.location.trim() || null,
          country: countries.find((c) => c.cc === b.cc)?.name ?? null,
          cc: b.cc,
          lang: b.lang.trim(),
          native_name: b.nativeName.trim() || null,
          lat: b.lat ? Number(b.lat) : null,
          lng: b.lng ? Number(b.lng) : null,
        });
        if (error) throw error;
        breweryName = b.name.trim();
      }
      if (!breweryName) throw new Error("Pick the brewery that makes this beer");

      const brewery = addingBrewery
        ? { cc: form.newBrewery.cc }
        : breweries.find((b) => b.name === breweryName);
      if (!brewery?.cc) throw new Error(`${breweryName} has no country set — fix it first`);

      // ── The place, likewise: the maps drop a review whose city is not a row.
      let placeCity = form.place;
      if (addingPlace) {
        const p = form.newPlace;
        if (!p.city.trim()) throw new Error("The new place needs a city");
        if (!p.region.trim()) throw new Error("The new place needs a region");
        if (!p.cc) throw new Error("The new place needs a country");
        const { error } = await supabase.from("locations").insert({
          city: p.city.trim(),
          region: p.region.trim(),
          country: countries.find((c) => c.cc === p.cc)?.name ?? "",
          cc: p.cc,
          lat: p.lat ? Number(p.lat) : null,
          lng: p.lng ? Number(p.lng) : null,
        });
        if (error) throw error;
        placeCity = p.city.trim();
      }
      if (!placeCity) throw new Error("Pick where you drank it");

      const place = addingPlace
        ? {
            city: form.newPlace.city.trim(),
            region: form.newPlace.region.trim(),
            country: countries.find((c) => c.cc === form.newPlace.cc)?.name ?? "",
            cc: form.newPlace.cc,
          }
        : locations.find((l) => l.city === placeCity);
      if (!place?.cc || !place.region)
        throw new Error(`${placeCity} is missing its region or country`);

      // ── The logo. Only asked for when this beer has none yet; the column
      // takes a bare domain, so a pasted URL is trimmed back to its host.
      const domain = form.domain
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "");
      if (!knownDomain && !domain)
        throw new Error("This beer has no logo domain yet — add one, like guinness.com");
      if (domain) {
        const { error } = await supabase
          .from("brand_domains")
          .upsert({ beer_name: name, domains: [domain] }, { onConflict: "beer_name" });
        if (error) throw error;
      }

      const payload = {
        name,
        brewery: breweryName,
        style: form.style,
        origin_cc: brewery.cc,
        abv,
        method: form.method,
        city: place.city,
        region: place.region,
        country: place.country,
        cc: place.cc,
        rating,
        is_new: form.isNew,
        drank_on: form.drank_on,
      };

      const { error } = editing
        ? await supabase.from("beers").update(payload).eq("id", beer.id)
        : await supabase.from("beers").insert(payload);
      if (error) throw error;

      toast.success(editing ? "Beer updated" : "Beer added");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["beers"] }),
        queryClient.invalidateQueries({ queryKey: ["breweries"] }),
        queryClient.invalidateQueries({ queryKey: ["locations"] }),
        queryClient.invalidateQueries({ queryKey: ["brand_domains"] }),
      ]);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
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

  const field = "h-11 rounded-xl";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-display">{editing ? "Edit beer" : "Add a beer"}</SheetTitle>
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
                placeholder="e.g. Guinness Draught"
                className={field}
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Brewery</Label>
              <Select value={form.brewery} onValueChange={(v) => set("brewery", v)}>
                <SelectTrigger className={field}>
                  <SelectValue placeholder="Who makes it?" />
                </SelectTrigger>
                <SelectContent>
                  {breweries.map((b) => (
                    <SelectItem key={b.id} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW}>+ Add a new brewery…</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {addingBrewery && (
              <div className="col-span-2 grid grid-cols-2 gap-3 rounded-xl border border-border bg-secondary/40 p-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="nb-name">Brewery name</Label>
                  <Input
                    id="nb-name"
                    value={form.newBrewery.name}
                    onChange={(e) => setNested("newBrewery", "name", e.target.value)}
                    placeholder="Brouwerij Bosteels"
                    className={field}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="nb-loc">Where it brews</Label>
                  <Input
                    id="nb-loc"
                    value={form.newBrewery.location}
                    onChange={(e) => setNested("newBrewery", "location", e.target.value)}
                    placeholder="Buggenhout, East Flanders"
                    className={field}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Country</Label>
                  <Select
                    value={form.newBrewery.cc}
                    onValueChange={(v) => setNested("newBrewery", "cc", v)}
                  >
                    <SelectTrigger className={field}>
                      <SelectValue placeholder="Country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((c) => (
                        <SelectItem key={c.cc} value={c.cc}>
                          {c.flag} {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nb-lang">Language</Label>
                  <Input
                    id="nb-lang"
                    value={form.newBrewery.lang}
                    onChange={(e) => setNested("newBrewery", "lang", e.target.value)}
                    placeholder="nl"
                    maxLength={2}
                    className={field}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nb-lat">Latitude</Label>
                  <Input
                    id="nb-lat"
                    type="number"
                    step="0.0001"
                    value={form.newBrewery.lat}
                    onChange={(e) => setNested("newBrewery", "lat", e.target.value)}
                    placeholder="51.0139"
                    className={field}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nb-lng">Longitude</Label>
                  <Input
                    id="nb-lng"
                    type="number"
                    step="0.0001"
                    value={form.newBrewery.lng}
                    onChange={(e) => setNested("newBrewery", "lng", e.target.value)}
                    placeholder="4.2003"
                    className={field}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="nb-native">Native name (optional)</Label>
                  <Input
                    id="nb-native"
                    value={form.newBrewery.nativeName}
                    onChange={(e) => setNested("newBrewery", "nativeName", e.target.value)}
                    placeholder="Only if it differs — サッポロビール"
                    className={field}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Style</Label>
              <Select value={form.style} onValueChange={(v) => set("style", v)}>
                <SelectTrigger className={field}>
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
                <SelectTrigger className={field}>
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
                className={field}
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
                className={field}
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Where you drank it</Label>
              <Select value={form.place} onValueChange={(v) => set("place", v)}>
                <SelectTrigger className={field}>
                  <SelectValue placeholder="Pick a place" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.city}>
                      {l.city}
                      {l.region ? `, ${l.region}` : ""} · {l.country}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW}>+ Add a new place…</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {addingPlace && (
              <div className="col-span-2 grid grid-cols-2 gap-3 rounded-xl border border-border bg-secondary/40 p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="np-city">City</Label>
                  <Input
                    id="np-city"
                    value={form.newPlace.city}
                    onChange={(e) => setNested("newPlace", "city", e.target.value)}
                    placeholder="Antwerp"
                    className={field}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="np-region">Region</Label>
                  <Input
                    id="np-region"
                    value={form.newPlace.region}
                    onChange={(e) => setNested("newPlace", "region", e.target.value)}
                    placeholder="Antwerp"
                    className={field}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Country</Label>
                  <Select
                    value={form.newPlace.cc}
                    onValueChange={(v) => setNested("newPlace", "cc", v)}
                  >
                    <SelectTrigger className={field}>
                      <SelectValue placeholder="Country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((c) => (
                        <SelectItem key={c.cc} value={c.cc}>
                          {c.flag} {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="np-lat">Latitude</Label>
                  <Input
                    id="np-lat"
                    type="number"
                    step="0.0001"
                    value={form.newPlace.lat}
                    onChange={(e) => setNested("newPlace", "lat", e.target.value)}
                    placeholder="51.2194"
                    className={field}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="np-lng">Longitude</Label>
                  <Input
                    id="np-lng"
                    type="number"
                    step="0.0001"
                    value={form.newPlace.lng}
                    onChange={(e) => setNested("newPlace", "lng", e.target.value)}
                    placeholder="4.4025"
                    className={field}
                  />
                </div>
              </div>
            )}

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="bf-domain">Logo domain</Label>
              <Input
                id="bf-domain"
                value={form.domain}
                onChange={(e) => set("domain", e.target.value)}
                placeholder={knownDomain ? knownDomain.join(", ") : "guinness.com"}
                className={field}
              />
              <p className="text-xs text-muted-foreground">
                {knownDomain
                  ? "Already known — leave blank to keep it."
                  : "The brand's own site. Without one, this beer shows a placeholder."}
              </p>
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="bf-date">Date</Label>
              <Input
                id="bf-date"
                type="date"
                value={form.drank_on}
                onChange={(e) => set("drank_on", e.target.value)}
                className={field}
              />
            </div>

            <div className="col-span-2 flex items-center gap-2.5">
              <Checkbox
                id="bf-new"
                checked={form.isNew}
                onCheckedChange={(v) => set("isNew", v === true)}
              />
              <Label htmlFor="bf-new" className="font-normal">
                First time trying this beer
              </Label>
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
