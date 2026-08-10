import { redirect } from "next/navigation";

/** Applicants live under each job: /employer/jobs/[jobId] */
export default function EmployerApplicantsRedirectPage() {
  redirect("/employer/jobs");
}
