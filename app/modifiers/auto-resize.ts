import Modifier from 'ember-modifier';
import { assert } from '@ember/debug';
import { action } from '@ember/object';

export default class AutoResizeModifier extends Modifier {
  declare element: HTMLTextAreaElement;

  didInstall(): void {
    assert(
      `Wrong element, expecting <textarea>, got <${this.element.tagName.toLowerCase()}>`,
      this.element.tagName === 'TEXTAREA'
    );

    this.element.addEventListener('input', this.resize);

    this.resize();
  }

  willDestroy(): void {
    this.element.removeEventListener('input', this.resize);
  }

  @action resize(): void {
    this.element.rows = Math.max(1, this.element.value.split('\n').length);
  }
}
