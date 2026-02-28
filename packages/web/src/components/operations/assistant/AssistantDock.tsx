import type { OperationsContext } from '@/services/operations';
import AssistantChatPanel from './AssistantChatPanel';
import ContextPreview from './ContextPreview';

type Props = {
  context?: OperationsContext | null;
};

export default function AssistantDock({ context }: Props) {
  return (
    <div className="space-y-3">
      <AssistantChatPanel />
      <ContextPreview context={context} />
    </div>
  );
}
