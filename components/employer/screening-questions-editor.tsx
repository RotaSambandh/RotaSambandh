"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listSuggestedPlatformQuestions } from "@/lib/dal/questions";

export type ScreeningDraft = {
  /** Stable key in the editor list (existing question id or temp id). */
  key: string;
  prompt: string;
  required: boolean;
  /** Set when this draft maps to an already-saved question. */
  existingId?: string;
  existingVersion?: number;
};

const MAX_QUESTIONS = 5;

const SUGGESTIONS = listSuggestedPlatformQuestions().map((q) => ({
  id: q.id,
  prompt: q.prompt,
  required: q.required,
}));

export function emptyScreeningDrafts(): ScreeningDraft[] {
  return [];
}

export function draftsFromQuestions(
  questions: Array<{
    id: string;
    prompt: string;
    required: boolean;
    version: number;
  }>,
): ScreeningDraft[] {
  return questions.map((q) => ({
    key: q.id,
    prompt: q.prompt,
    required: q.required,
    existingId: q.id,
    existingVersion: q.version,
  }));
}

/**
 * Simple screening-question picker for job create/edit.
 * Suggestions are helpers only; nothing is attached until the employer keeps it in this list.
 */
export function ScreeningQuestionsEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: ScreeningDraft[];
  onChange: (next: ScreeningDraft[]) => void;
  disabled?: boolean;
}) {
  const [custom, setCustom] = useState("");

  const usedPrompts = new Set(value.map((d) => d.prompt.trim().toLowerCase()));
  const unusedSuggestions = SUGGESTIONS.filter(
    (s) => !usedPrompts.has(s.prompt.trim().toLowerCase()),
  );

  function addSuggestion(prompt: string, required: boolean) {
    if (value.length >= MAX_QUESTIONS || disabled) return;
    onChange([
      ...value,
      {
        key: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        prompt,
        required,
      },
    ]);
  }

  function addCustom() {
    const prompt = custom.trim();
    if (!prompt || value.length >= MAX_QUESTIONS || disabled) return;
    onChange([
      ...value,
      {
        key: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        prompt,
        required: false,
      },
    ]);
    setCustom("");
  }

  function removeAt(key: string) {
    onChange(value.filter((d) => d.key !== key));
  }

  function toggleRequired(key: string) {
    onChange(
      value.map((d) => (d.key === key ? { ...d, required: !d.required } : d)),
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Screening questions (optional)</Label>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Applicants answer these when they apply. Keep it to a few short prompts
          (max {MAX_QUESTIONS}). Leave empty if resume and profile are enough.
        </p>
      </div>

      {value.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--color-border)] px-3 py-3 text-sm text-[var(--color-muted)]">
          No questions attached yet. Add a suggestion below or write your own.
        </p>
      ) : (
        <ul className="space-y-2">
          {value.map((draft, index) => (
            <li
              key={draft.key}
              className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[var(--color-ink)]">
                  {index + 1}. {draft.prompt}
                </p>
                <button
                  type="button"
                  disabled={disabled}
                  className="mt-1 text-xs text-[var(--color-accent-strong)] hover:underline disabled:opacity-50"
                  onClick={() => toggleRequired(draft.key)}
                >
                  {draft.required ? "Required" : "Optional"} (click to toggle)
                </button>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={disabled}
                onClick={() => removeAt(draft.key)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      {unusedSuggestions.length > 0 && value.length < MAX_QUESTIONS ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Suggested helpers
          </p>
          <ul className="mt-2 space-y-2">
            {unusedSuggestions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="text-[var(--color-muted)]">{s.prompt}</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={disabled}
                  onClick={() => addSuggestion(s.prompt, s.required)}
                >
                  Add
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {value.length < MAX_QUESTIONS ? (
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Write your own question"
            value={custom}
            disabled={disabled}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            className="max-w-md"
          />
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || !custom.trim()}
            onClick={addCustom}
          >
            Add question
          </Button>
        </div>
      ) : (
        <p className="text-xs text-[var(--color-muted)]">
          Maximum of {MAX_QUESTIONS} questions reached.
        </p>
      )}
    </div>
  );
}
