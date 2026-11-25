"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

import type { CookingProgress } from "@/lib/cooking-progress";

export function CookingMode({
  open, recipe, progress, ingredients, steps, onStep, onClose, onFinish,
}: {
  open: boolean;
  recipe: string;
  progress: CookingProgress;
  ingredients: { id: string; name: string; quantity: string }[];
  steps: { id: string; text: string }[];
  onStep: (stepId: string | null) => void;
  onClose: () => void;
  onFinish: () => void;
}) {
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const index = steps.findIndex(step => step.id === progress.stepId);
  const step = steps[index];
  const showingIngredients = !step || ingredientsOpen;

  useEffect(() => {
    heading.current?.scrollIntoView({ block: "nearest" });
    heading.current?.focus({ preventScroll: true });
  }, [open, step?.id, showingIngredients]);

  return (
    <Sheet
      open={open}
      fullscreen
      onClose={() => {
        setIngredientsOpen(false);
        onClose();
      }}
      title="Mod de gătit"
      footer={
        <div className="mx-auto flex max-w-xl gap-3">
          {step && !showingIngredients && (
            <Button variant="secondary" onClick={() => onStep(steps[index - 1]?.id ?? null)}>Înapoi</Button>
          )}
          {showingIngredients ? (
            <Button className="min-w-0 flex-1" onClick={() => {
              if (!step) onStep(steps[0].id);
              setIngredientsOpen(false);
            }}>
              {step ? "Continuă prepararea" : "Începe prepararea"}
            </Button>
          ) : index + 1 < steps.length ? (
            <Button className="flex-1" onClick={() => onStep(steps[index + 1].id)}>Următorul</Button>
          ) : (
            <Button className="flex-1" onClick={onFinish}>Am gătit</Button>
          )}
        </div>
      }
    >
      <div className="mx-auto max-w-xl">
        <p className="text-sm text-on-surface-variant">{recipe} · {progress.servings} {progress.servings === 1 ? "porție" : "porții"}</p>
        <h3 ref={heading} tabIndex={-1} data-autofocus className="mt-6 text-2xl font-semibold outline-none">
          {showingIngredients ? "Ingrediente" : `Pasul ${index + 1} din ${steps.length}`}
        </h3>
        {showingIngredients ? (
          ingredients.length ? (
            <ul className="mt-4 divide-y divide-outline-variant">
              {ingredients.map(ingredient => (
                <li key={ingredient.id} className="flex items-baseline justify-between gap-4 py-3">
                  <span className="min-w-0 break-words text-base">{ingredient.name}</span>
                  <span className="shrink-0 text-sm font-semibold tabular">{ingredient.quantity}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 text-on-surface-variant">Rețeta nu are ingrediente listate.</p>
        ) : (
          <>
            <p className="mt-4 whitespace-pre-line break-words text-[clamp(1.25rem,5.5vw,2rem)] leading-relaxed">{step.text}</p>
            <Button variant="outlined" size="sm" className="mt-6" onClick={() => setIngredientsOpen(true)}>Vezi ingredientele</Button>
          </>
        )}
      </div>
    </Sheet>
  );
}
