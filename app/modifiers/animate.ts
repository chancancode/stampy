import Modifier from 'ember-modifier';

export async function animateIn(element: HTMLElement, displayMode = 'grid'): Promise<void> {
  if (element.style.display === displayMode) {
    return;
  }

  element.style.display = displayMode;

  if (typeof element.animate === 'function') {
    let animation = element.animate([{
      transform: 'translateY(100%)',
      opacity: 0
    }, {
      transform: 'translateY(0%)',
      opacity: 1
    }], {
      duration: 500,
      easing: 'ease-in-out'
    });

    await animation.finished;
  }
}

export async function animateOut(element: HTMLElement): Promise<void> {
  if (element.style.display === 'none') {
    return;
  }

  if (typeof element.animate === 'function') {
    let animation = element.animate([{
      transform: 'translateY(0%)',
      opacity: 1
    }, {
      transform: 'translateY(100%)',
      opacity: 0
    }], {
      duration: 500,
      easing: 'ease-in-out'
    });

    await animation.finished;
  }

  element.style.display = 'none';
}

interface AnimateModifierArgs {
  positional: [show: boolean];
  named: {};
}

export default class AnimateModifier extends Modifier<AnimateModifierArgs> {
  declare element: HTMLTextAreaElement;

  didReceiveArguments(): void {
    if (this.args.positional[0]) {
      animateIn(this.element);
    } else {
      animateOut(this.element);
    }
  }
}
