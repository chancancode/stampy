// Types for compiled templates
declare module 'stamps/templates/*' {
  import { TemplateFactory } from 'htmlbars-inline-precompile';
  const tmpl: TemplateFactory;
  export default tmpl;
}

interface Window {
  scripts: Record<string, Promise<Event>>;
}
