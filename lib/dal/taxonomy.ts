import { collection, doc, setDoc } from "firebase/firestore";
import type { Category, Skill } from "@/shared/types";
import { getClientFirestore, isFirebaseConfigured } from "@/lib/firebase/client";
import { now, slugify } from "@/lib/utils";
import { listCategoriesRtdb, listSkillsRtdb } from "@/lib/dal/admin-rtdb";

const defaultCategories: Category[] = [
  { id: "cat_tech", name: "Technology", slug: "technology", active: true, createdAt: 0, updatedAt: 0 },
  { id: "cat_marketing", name: "Marketing", slug: "marketing", active: true, createdAt: 0, updatedAt: 0 },
  { id: "cat_ops", name: "Operations", slug: "operations", active: true, createdAt: 0, updatedAt: 0 },
];

const defaultSkills: Skill[] = [
  { id: "sk_react", name: "React", slug: "react", active: true, createdAt: 0, updatedAt: 0 },
  { id: "sk_product", name: "Product", slug: "product", active: true, createdAt: 0, updatedAt: 0 },
  { id: "sk_analytics", name: "Analytics", slug: "analytics", active: true, createdAt: 0, updatedAt: 0 },
];

export async function listCategories(): Promise<Category[]> {
  if (!isFirebaseConfigured()) return defaultCategories;
  const list = await listCategoriesRtdb();
  return list.length ? list : defaultCategories;
}

export async function listSkills(): Promise<Skill[]> {
  if (!isFirebaseConfigured()) return defaultSkills;
  const list = await listSkillsRtdb();
  return list.length ? list : defaultSkills;
}

export async function upsertCategory(name: string): Promise<Category> {
  const ts = now();
  const slug = slugify(name);
  const id = `cat_${slug}`;
  const category: Category = { id, name, slug, active: true, createdAt: ts, updatedAt: ts };
  if (!isFirebaseConfigured()) return category;
  await setDoc(doc(getClientFirestore(), "categories", id), category, { merge: true });
  return category;
}

export async function upsertSkill(name: string): Promise<Skill> {
  const ts = now();
  const slug = slugify(name);
  const id = `sk_${slug}`;
  const skill: Skill = { id, name, slug, active: true, createdAt: ts, updatedAt: ts };
  if (!isFirebaseConfigured()) return skill;
  await setDoc(doc(getClientFirestore(), "skills", id), skill, { merge: true });
  return skill;
}
