import { LiveClassView } from "@/components/live-class/LiveClassView";
import { RoleGate } from "@/components/shell/RoleGate";

export default function LiveClassPage() {
  return (
    <RoleGate>
      <LiveClassView />
    </RoleGate>
  );
}
