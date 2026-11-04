import { KnowledgeGraphView } from "@/components/knowledge-graph/KnowledgeGraphView";
import { RoleGate } from "@/components/shell/RoleGate";

export default function KnowledgeGraphPage() {
  return (
    <RoleGate>
      <KnowledgeGraphView />
    </RoleGate>
  );
}
