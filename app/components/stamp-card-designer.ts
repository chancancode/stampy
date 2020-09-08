import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

import Ember from 'ember';
import { assert } from '@ember/debug';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import Store from '@ember-data/store';

import Router from 'stampy/router';
import { SharingOptions } from 'stampy/adapters/application';
import StampCard from 'stampy/models/stamp-card';

type Slot = [Date, string?] | undefined;

interface StampCardAttributes {
  title: string;
  description: string;
  backgroundColor: string;
  foregroundColor: string;
  goal: number;
  expirationDate?: Date;
  terms: readonly string[];
}

interface StampCardStub extends StampCardAttributes {
  slots: readonly Slot[];
}

interface StampCardDesignerArgs {
  card?: StampCard;
}

const PLACEHOLDERS: Readonly<StampCardAttributes> = Object.freeze({
  title: 'Free Drink',
  description: 'Fill this up and get a free drink on me!',
  backgroundColor: '#666666',
  foregroundColor: '#ffffff',
  goal: 10,
  expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  terms: [
    'Offer is not transferable.',
    'No purchase necessary.',
    'No cash value.',
    'All rights reserved.',
    'Void where prohibited.'
  ]
});

let ID = 0;

export default class StampCardDesignerComponent extends Component<StampCardDesignerArgs> {
  id = `stamp-card-designer-${ID++}`;

  @service store!: Store;
  @service router!: Router;

  placeholders = PLACEHOLDERS;

  initial = this.args.card || PLACEHOLDERS;

  // Assigned in resetFields()
  @tracked title!: string;
  @tracked description!: string;
  @tracked backgroundColor!: string;
  @tracked foregroundColor!: string;
  @tracked goal!: number;
  @tracked expires!: boolean;
  @tracked expirationDate?: Date;
  @tracked terms!: readonly string[];

  @tracked emailAddress = '';
  @tracked sendNotificationEmail = true;
  @tracked emailMessage = '';

  @tracked isSubmitting = false;

  constructor(owner: unknown, args: StampCardDesignerArgs) {
    super(owner, args);
    this.resetFields();
  }

  private resetFields(): void {
    let {
      title,
      description,
      backgroundColor,
      foregroundColor,
      goal,
      expirationDate,
      terms
    } = this.initial;

    let expires = !!expirationDate;

    Object.assign(this, {
      title,
      description,
      backgroundColor,
      foregroundColor,
      goal,
      expires,
      expirationDate,
      terms
    });
  }

  get isNew(): boolean {
    return this.args.card === undefined;
  }

  get isEdit(): boolean {
    return !this.isNew;
  }

  get expirationDateValue(): string {
    let { expirationDate: date } = this;

    if (date) {
      return `${date.toISOString().slice(0, 10)}`;
    } else {
      return '';
    }
  }

  set expirationDateValue(value: string) {
    let date = new Date(value);

    if (isNaN(date.valueOf())) {
      this.expirationDate = undefined;
    } else {
      this.expirationDate = date;
    }
  }

  get termsValue(): string {
    return this.terms.join('\n');
  }

  set termsValue(value: string) {
    value = value.trim();

    if (value) {
      this.terms = Object.freeze(value.trim().split('\n'));
    } else {
      this.terms = Object.freeze([]);
    }
  }

  get attributes(): StampCardAttributes {
    let {
      title,
      description,
      backgroundColor,
      foregroundColor,
      goal,
      expires,
      expirationDate,
      terms
    } = this;

    return {
      title,
      description,
      backgroundColor,
      foregroundColor,
      goal,
      expirationDate: expires ? expirationDate : undefined,
      terms
    };
  }

  get adapterOptions(): SharingOptions {
    let {
      emailAddress,
      emailMessage,
      sendNotificationEmail
    } = this;

    return {
      emailAddress,
      emailMessage: sendNotificationEmail ? emailMessage : undefined,
      sendNotificationEmail
    };
  }

  get slots(): Slot[] {
    let slots: Slot[] = [];
    let filled = Math.round(this.goal * 2 / 5);

    for (let i=0; i<this.goal; i++) {
      if (i < filled) {
        slots.push([new Date(), `Placeholder stamp ${i+1}`]);
      } else {
        slots.push(undefined);
      }
    }

    return slots;
  }

  get preview(): StampCardStub {
    return {
      ...this.attributes,
      slots: this.slots
    };
  }

  @action submit(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.isSubmitting) {
      return;
    }

    let { attributes, adapterOptions } = this;

    this.isSubmitting = true;

    let promise: Promise<unknown>;

    if (this.isNew) {
      promise = this.store
        .createRecord('stamp-card', attributes)
        .save({ adapterOptions });
    } else {
      let { card } = this.args;

      assert('Missing this.args.card', card);

      Object.assign(card, attributes);

      promise = card.save();
    }

    promise.then(
      () => this.router.transitionTo('give'),
      Ember.onerror
    );
  }

  @action reset(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.resetFields();
  }
}
