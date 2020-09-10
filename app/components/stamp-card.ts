import Component from '@glimmer/component';

import { action } from '@ember/object';

import { onError } from 'stampy/app';
import StampCard from 'stampy/models/stamp-card';

interface StampCardArgs {
  card: StampCard;
}

interface Slot {
  filled: boolean;
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

    let { filled, goal } = this.card;

    for (let i=0; i<goal; i++) {
      slots.push({ filled: i < filled });
    }

    return slots;
  }

  @action trash(): void {
    let { card } = this.args;

    if (card && confirm('Are you sure?')) {
      card
        .destroyRecord()
        .then(c => c.unloadRecord())
        .catch(onError);
    }
  }
}
