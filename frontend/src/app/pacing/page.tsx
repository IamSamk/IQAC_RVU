import { PacingStudio } from "@/components/pacing/PacingStudio";
import { RoleGate } from "@/components/shell/RoleGate";

export default function PacingPage() {
  return (
    <RoleGate>
      <PacingStudio />
    </RoleGate>
  );
}
