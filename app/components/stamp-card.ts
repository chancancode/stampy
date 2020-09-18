import Component from '@glimmer/component';

import { action } from '@ember/object';
import { inject as service } from '@ember/service';

import { softLight } from 'color-blend';

import { onError } from 'stampy/app';
import Router from 'stampy/router';
import StampCard from 'stampy/models/stamp-card';
import { ContextMenuAction } from 'stampy/components/context-menu';

interface StampCardArgs {
  card: StampCard;
  inert?: boolean;
}

interface Slot {
  filled: boolean;
  actions: ContextMenuAction[];
}

export default class StampCardComponent extends Component<StampCardArgs> {
  @service declare router: Router;

  get card(): StampCard {
    return this.args.card;
  }

  get inert(): boolean {
    return !!this.args.inert;
  }

  get size(): string {
    if (this.card.goal > 30) {
      return 'tiny';
    } else if (this.card.goal > 20) {
      return 'small';
    } else {
      return 'regular'
    }
  }

  get slots(): Slot[] {
    let slots: Slot[] = [];

    let { inert } = this;
    let { filled: numFilled, goal, isSentFromMe, isSentToMe } = this.card;

    for (let i=0; i<goal; i++) {
      let filled = i < numFilled;
      let actions: ContextMenuAction[] = [];

      if (!inert) {
        if (isSentFromMe && filled) {
          actions.push({
            label: 'Edit Note',
            icon: 'note',
            callback: () => alert('Edit Note')
          });

          actions.push({
            label: 'Remove Stamp',
            icon: 'trash',
            dangerous: true,
            callback: () => alert('Remove Stamp')
          });
        }

        if (isSentFromMe && !filled) {
          actions.push({
            label: 'Give Stamp',
            icon: 'check',
            callback: () => alert('Give Stamp')
          });
        }

        if (isSentToMe && !filled) {
          actions.push({
            label: 'Request Stamp',
            icon: 'bubble-check',
            callback: () => alert('Request Stamp')
          });
        }
      }

      slots.push({ filled, actions });
    }

    return slots;
  }

  // Chrome's native CSS blending is very slow for some reason
  get stampBackgroundColor(): string {
    let hex = this.card.backgroundColor || '#000000';

    let background = {
      r: parseInt(hex.slice(1, 3), 16) || 0,
      g: parseInt(hex.slice(3, 5), 16) || 0,
      b: parseInt(hex.slice(5, 7), 16) || 0,
      a: 1
    };

    let foreground = {
      r: 255,
      g: 255,
      b: 255,
      a: 0.5
    };

    let { r, g, b, a } = softLight(background, foreground);

    return `rgba(${
      r.toFixed(0)
    }, ${
      g.toFixed(0)
    }, ${
      b.toFixed(0)
    }, ${
      a.toFixed(2)
    })`;
  }

  get cardActions(): ContextMenuAction[] {
    let actions: ContextMenuAction[] = [];

    if (this.card.isSentFromMe) {
      actions.push({
        label: 'Edit Card',
        icon: 'edit',
        callback: this.editCard
      });

      actions.push({
        label: 'Delete Card',
        icon: 'trash',
        dangerous: true,
        callback: this.deleteCard
      });
    }

    return actions;
  }

  @action editCard(): void {
    this.router.transitionTo('give.edit', this.card.id);
  }

  @action deleteCard(): void {
    if (confirm('Are you sure?')) {
      this.card
        .destroyRecord()
        .then(c => c.unloadRecord())
        .catch(onError);
    }
  }
}
