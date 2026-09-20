// strips the obvious stuff before we render user text as HTML
export function sanitizeHtml(input: any): string {
  return input.replace(/<script>/gi, "").replace(/<\/script>/gi, "");
}
