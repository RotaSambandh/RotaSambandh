import { redirect } from "next/navigation";

/** Saved jobs removed to avoid unnecessary Firestore writes. */
export default function SavedJobsRedirectPage() {
  redirect("/jobs");
}
