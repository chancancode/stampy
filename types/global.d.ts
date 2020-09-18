// Types for compiled templates
declare module 'stampy/templates/*' {
  import { TemplateFactory } from 'htmlbars-inline-precompile';
  const tmpl: TemplateFactory;
  export default tmpl;
}

interface Window {
  scripts: Record<string, Promise<Event>>;
}

interface HTMLElement {
  inert: boolean;
}
