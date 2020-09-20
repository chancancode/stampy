import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as controller } from '@ember/controller';

import ApplicationController from 'stampy/controllers/application';

interface ModalArgs {
  animateIn?: boolean;
  animateOut?: boolean;
}

export default class ModalComponent extends Component<ModalArgs> {
  @controller declare application: ApplicationController;

  container = document.body;

  get animateIn(): boolean {
    return this.args.animateIn ?? true;
  }

  get animateOut(): boolean {
    return this.args.animateOut ?? true;
  }

  @action willOpen(element: HTMLElement): void {
    this.application.inert = true;

    if (this.animateIn) {
      if (typeof element.animate === 'function') {
        element.animate([{
          transform: 'translateY(100%)',
          opacity: 0
        }, {
          transform: 'translateY(0%)',
          opacity: 1
        }], {
          duration: 500,
          easing: 'ease-in-out',
          fill: 'forwards'
        });
      } else {
        requestAnimationFrame(() => {
          element.style.transform = 'translateY(0%)';
          element.style.opacity = '1';
        });
      }
    } else {
      element.style.transform = 'translateY(0%)';
      element.style.opacity = '1';
    }
  }

  @action didClose(element: HTMLElement): void {
    this.application.inert = false;

    if (this.animateOut) {
      let ghost = element.cloneNode(true) as HTMLElement;
      ghost.inert = true;
      ghost.setAttribute('aria-hidden', 'true');
      ghost.classList.add('ghost');

      element.style.display = 'none';
      document.body.appendChild(ghost);

      if (typeof ghost.animate === 'function') {
        ghost.animate([{
          transform: 'translateY(0%)',
          opacity: 1
        }, {
          transform: 'translateY(100%)',
          opacity: 0
        }], {
          duration: 500,
          easing: 'ease-in-out',
          fill: 'forwards'
        }).finished.then(() => {
          ghost.remove();
        });
      } else {
        requestAnimationFrame(() => {
          ghost.style.transform = 'translateY(100%)';
          ghost.style.opacity = '0';

          setTimeout(() => {
            ghost.remove();
          }, 500);
        });
      }
    }
  }
}
