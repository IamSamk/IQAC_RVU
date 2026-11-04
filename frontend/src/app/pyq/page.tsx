import { PyqExplorer } from "@/components/pyq/PyqExplorer";
import { RoleGate } from "@/components/shell/RoleGate";

export default function PyqPage() {
  return (
    <RoleGate>
      <PyqExplorer />
    </RoleGate>
  );
}
