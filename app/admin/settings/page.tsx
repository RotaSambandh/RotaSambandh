"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  createQuestion,
  listPlatformQuestions,
  updatePlatformQuestion,
} from "@/lib/dal/questions";
import { listCategories, listSkills, upsertCategory, upsertSkill } from "@/lib/dal/taxonomy";
import { usePlatformAccess } from "@/hooks/use-platform-access";
import type { Category, Question, QuestionType, Skill } from "@/shared/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MenuSelect } from "@/components/ui/menu-select";
import { Badge } from "@/components/ui/badge";
import { Banner, EmptyState, PageHeader, Panel } from "@/components/ui";

const QUESTION_TYPE_OPTIONS = [
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "single_choice", label: "Single choice" },
  { value: "multiple_choice", label: "Multi choice" },
  { value: "yes_no", label: "Yes / No" },
];

export default function AdminSettingsPage() {
  const { canWrite } = usePlatformAccess();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    void listPlatformQuestions().then(setQuestions);
    void listCategories().then(setCategories);
    void listSkills().then(setSkills);
  }, []);

  async function addQuestion(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canWrite) return;
    const fd = new FormData(e.currentTarget);
    const q = await createQuestion({
      scope: "platform",
      type: String(fd.get("type") || "short_text") as Question["type"],
      prompt: String(fd.get("prompt")),
      required: true,
      platformKey: String(fd.get("key")),
    });
    setQuestions((prev) => [...prev, q]);
    e.currentTarget.reset();
  }

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canWrite || !editingId) return;
    setEditError(null);
    setSavingEdit(true);
    try {
      const fd = new FormData(e.currentTarget);
      const updated = await updatePlatformQuestion(editingId, {
        prompt: String(fd.get("prompt") ?? ""),
        type: String(fd.get("type") || "short_text") as QuestionType,
        platformKey: String(fd.get("key") ?? ""),
        required: fd.get("required") === "on",
      });
      setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Could not save question");
    } finally {
      setSavingEdit(false);
    }
  }

  async function deactivateQuestion(id: string) {
    if (!canWrite) return;
    const updated = await updatePlatformQuestion(id, { active: false });
    setQuestions((prev) => prev.filter((q) => q.id !== updated.id));
    if (editingId === id) setEditingId(null);
  }

  async function addCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canWrite) return;
    const fd = new FormData(e.currentTarget);
    const cat = await upsertCategory(String(fd.get("name")));
    setCategories((prev) => [...prev.filter((c) => c.id !== cat.id), cat]);
    e.currentTarget.reset();
  }

  async function addSkill(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canWrite) return;
    const fd = new FormData(e.currentTarget);
    const skill = await upsertSkill(String(fd.get("name")));
    setSkills((prev) => [...prev.filter((s) => s.id !== skill.id), skill]);
    e.currentTarget.reset();
  }

  return (
    <main className="mx-auto max-w-4xl space-y-10 px-4 py-8 sm:px-6">
      <PageHeader
        title="Settings"
        description="Shared application questions and taxonomy used across employer job forms and candidate applications."
      />

      {!canWrite && (
        <Banner tone="warning" title="Coordinator view">
          Taxonomy is read-only for coordinators. Ask an admin to add or change entries.
        </Banner>
      )}

      <Panel title="Platform questions">
        <p className="mb-4 text-sm leading-relaxed text-[var(--color-muted)]">
          These are standard questions offered on every job application (location, experience,
          notice period, etc.). Employers can attach them when composing a role. The{" "}
          <strong className="font-semibold text-[var(--color-ink)]">version</strong> number
          (v1, v2…) is not a product tier. It increments when a question&apos;s wording or answer
          type changes so historical applications keep the prompt they answered.{" "}
          <strong className="font-semibold text-[var(--color-ink)]">Platform key</strong> is a
          stable machine id (for example <code className="text-xs">notice_period</code>) used in
          analytics and reporting.
        </p>

        {questions.length === 0 ? (
          <EmptyState
            title="No platform questions"
            description="Add the first shared question employers can attach to applications."
          />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {questions.map((q) => {
              const isEditing = editingId === q.id;
              return (
                <li key={q.id} className="py-3">
                  {!isEditing ? (
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--color-ink)]">{q.prompt}</p>
                        <p className="mt-1 text-xs text-[var(--color-muted)]">
                          Key: <code>{q.platformKey || "none"}</code>
                          {" · "}
                          Type: {q.type.replaceAll("_", " ")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="neutral">v{q.version}</Badge>
                        {canWrite ? (
                          <>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setEditError(null);
                                setEditingId(q.id);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => void deactivateQuestion(q.id)}
                            >
                              Remove
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={saveEdit} className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                      <div>
                        <Label htmlFor={`edit-prompt-${q.id}`}>Question prompt</Label>
                        <Input
                          id={`edit-prompt-${q.id}`}
                          name="prompt"
                          required
                          defaultValue={q.prompt}
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label htmlFor={`edit-key-${q.id}`}>Platform key</Label>
                          <Input
                            id={`edit-key-${q.id}`}
                            name="key"
                            required
                            defaultValue={q.platformKey ?? ""}
                            placeholder="notice_period"
                          />
                        </div>
                        <MenuSelect
                          id={`edit-type-${q.id}`}
                          name="type"
                          label="Answer type"
                          defaultValue={q.type}
                          options={QUESTION_TYPE_OPTIONS}
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
                        <input
                          type="checkbox"
                          name="required"
                          defaultChecked={q.required}
                          className="h-4 w-4 rounded border-[var(--color-border)]"
                        />
                        Required on applications
                      </label>
                      <p className="text-xs text-[var(--color-muted)]">
                        Changing the prompt or answer type bumps the version (currently v{q.version}
                        ). Past applications keep their original wording via prompt snapshots.
                      </p>
                      {editError ? (
                        <p role="alert" className="text-sm text-[var(--color-danger)]">
                          {editError}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" disabled={savingEdit}>
                          {savingEdit ? "Saving…" : "Save changes"}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={savingEdit}
                          onClick={() => {
                            setEditingId(null);
                            setEditError(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {canWrite && (
          <form onSubmit={addQuestion} className="mt-6 space-y-3 border-t border-[var(--color-border)] pt-6">
            <div>
              <Label htmlFor="prompt">Question prompt</Label>
              <Input id="prompt" name="prompt" required placeholder="What is your notice period?" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="key">Platform key</Label>
                <Input id="key" name="key" required placeholder="notice_period" />
              </div>
              <div>
                <MenuSelect
                  id="type"
                  name="type"
                  label="Answer type"
                  defaultValue="short_text"
                  options={QUESTION_TYPE_OPTIONS}
                />
              </div>
            </div>
            <Button type="submit">Add question</Button>
          </form>
        )}
      </Panel>

      <div className="grid gap-8 sm:grid-cols-2">
        <Panel title="Categories">
          <p className="mb-4 text-sm text-[var(--color-muted)]">
            High-level job families (Technology, Marketing, Operations…). Employers pick these when
            classifying a role.
          </p>
          {categories.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No categories yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {categories.map((c) => (
                <li key={c.id}>{c.name}</li>
              ))}
            </ul>
          )}
          {canWrite && (
            <form onSubmit={addCategory} className="mt-4 space-y-2">
              <Input name="name" placeholder="Category name" required />
              <Button type="submit">Add category</Button>
            </form>
          )}
        </Panel>

        <Panel title="Skills">
          <p className="mb-4 text-sm text-[var(--color-muted)]">
            Skill tags candidates and jobs share (React, Product, Analytics…). Used for filtering and
            matching.
          </p>
          {skills.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No skills yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {skills.map((s) => (
                <li key={s.id}>{s.name}</li>
              ))}
            </ul>
          )}
          {canWrite && (
            <form onSubmit={addSkill} className="mt-4 space-y-2">
              <Input name="name" placeholder="Skill name" required />
              <Button type="submit">Add skill</Button>
            </form>
          )}
        </Panel>
      </div>
    </main>
  );
}
