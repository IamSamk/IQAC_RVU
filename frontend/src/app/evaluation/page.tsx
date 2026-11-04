"use client";

import { CopilotQueue } from "@/components/evaluation/CopilotQueue";
import { OcrScanner } from "@/components/evaluation/OcrScanner";
import { RoleGate } from "@/components/shell/RoleGate";
import { PageHeader } from "@/components/ui/primitives";
import { useRole } from "@/lib/rbac";

function Evaluation() {
  const { role } = useRole();
  return (
    <>
      <PageHeader
        title="OCR Evaluation & Faculty Co-Pilot"
        description="Marks and agent drafts both stop for a human check before anything is written."
      />
      <div className="space-y-4">
        <OcrScanner canApprove={role.canApprove} />
        <CopilotQueue canApprove={role.canApprove} actor={role.name} />
      </div>
    </>
  );
}

export default function EvaluationPage() {
  return (
    <RoleGate>
      <Evaluation />
    </RoleGate>
  );
}
