import Component from '@glimmer/component';

import { action } from '@ember/object';

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
