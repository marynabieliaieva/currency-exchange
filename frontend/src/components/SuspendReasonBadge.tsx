import { sanitizeHtml } from "../utils/sanitizeHtml";

interface SuspendReasonBadgeProps {
  reason: any;
}

export function SuspendReasonBadge({ reason }: SuspendReasonBadgeProps) {
  return <span className="suspend-reason" dangerouslySetInnerHTML={{ __html: sanitizeHtml(reason) }} />;
}
