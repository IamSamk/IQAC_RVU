import { AdminErp } from "@/components/admin/AdminErp";
import { RoleGate } from "@/components/shell/RoleGate";

export default function AdminPage() {
  return (
    <RoleGate>
      <AdminErp />
    </RoleGate>
  );
}
