"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app/shell";
import { useApp } from "@/components/app/app-provider";
import { useData } from "@/components/app/hooks";
import { RecipeEditor } from "@/components/recipes/recipe-editor";
import { Spinner } from "@/components/ui/misc";
import { productMap } from "@/lib/services/queries";

function Editor() {
  const params = useSearchParams();
  const { isAppAdmin } = useApp();
  const id = params.get("id");
  const source = useData(
    async (ctx) => {
      const products = await productMap(ctx.db, ctx.householdId);
      if (!id) return { products, recipe: null, ingredients: [], steps: [] };
      const recipe = (await ctx.db.recipes.get(id)) ?? null;
      const ings = (await ctx.db.recipe_ingredients.where("recipe_id").equals(id).toArray()).filter((i) => !i.deleted_at).sort((a, b) => a.sort_order - b.sort_order);
      const st = (await ctx.db.recipe_steps.where("recipe_id").equals(id).toArray()).filter((s) => !s.deleted_at).sort((a, b) => a.position - b.position);
      return { products, recipe, ingredients: ings, steps: st };
    },
    [id],
  );
  if (!source) return <Spinner />;
  const isGlobal = source.recipe ? source.recipe.household_id === null : params.get("global") === "1" && isAppAdmin;
  // Formularul pornește o singură dată din datele salvate (cheia îl reinițializează la altă rețetă).
  return <RecipeEditor key={id ?? "nou"} id={id} isGlobal={isGlobal} source={source} />;
}

export default function Page() {
  return (
    <AppShell>
      <Suspense fallback={<Spinner />}>
        <Editor />
      </Suspense>
    </AppShell>
  );
}
