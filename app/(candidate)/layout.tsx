import { RoleShell } from "@/components/layout/role-shell";

export default function CandidatePortalLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell role="candidate">{children}</RoleShell>;
}
