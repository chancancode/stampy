import Component from '@glimmer/component';

import { action } from '@ember/object';

import { softLight } from 'color-blend';

import { onError } from 'stampy/app';
import StampCard from 'stampy/models/stamp-card';
import { ContextMenuItem } from 'stampy/components/context-menu';

interface StampCardArgs {
  card: StampCard;
  inert?: boolean;
}

interface Slot {
  filled: boolean;
  items: ContextMenuItem[];
}

export default class StampCardComponent extends Component<StampCardArgs> {
  get card(): StampCard {
    return this.args.card;
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

    let { filled: numFilled, goal, isSentFromMe, isSentToMe } = this.card;

    for (let i=0; i<goal; i++) {
      let filled = i < numFilled;
      let items: ContextMenuItem[] = [];

      if (isSentFromMe && filled) {
        items.push({
          label: 'Edit Note',
          icon: 'note',
          callback: () => alert('Edit Note')
        });

        items.push({
          label: 'Remove Stamp',
          icon: 'trash',
          dangerous: true,
          callback: () => alert('Remove Stamp')
        });
      }

      if (isSentFromMe && i === numFilled) {
        items.push({
          label: 'Give Stamp',
          icon: 'check',
          callback: () => alert('Give Stamp')
        });
      }

      if (isSentToMe && i === numFilled) {
        items.push({
          label: 'Request Stamp',
          icon: 'bubble-check',
          callback: () => alert('Request Stamp')
        });
      }

      slots.push({ filled, items });
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

  @action delete(): void {
    let { card } = this.args;

    if (card && confirm('Are you sure?')) {
      card
        .destroyRecord()
        .then(c => c.unloadRecord())
        .catch(onError);
    }
  }
}
