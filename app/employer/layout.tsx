import { RoleShell } from "@/components/layout/role-shell";
import { ActiveBusinessProvider } from "@/components/employer/active-business-provider";
import { EmployerPendingBanner } from "@/components/employer/employer-pending-banner";

export default function EmployerLayout({ children }: { children: React.ReactNode }) {
  return (
    <ActiveBusinessProvider>
      <RoleShell role="employer">
        <EmployerPendingBanner />
        {children}
      </RoleShell>
    </ActiveBusinessProvider>
  );
}
