import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

import Ember from 'ember';
import { getOwner } from '@ember/application';
import { assert } from '@ember/debug';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import Store from '@ember-data/store';

import Router from 'stampy/router';
import { SharingOptions } from 'stampy/adapters/application';
import StampCard from 'stampy/models/stamp-card';

function pad(value: number, length = 2): string {
  return value.toFixed(0).padStart(length, '0');
}

function parseDate(value: string): Date | undefined {
  let date: Date | undefined;
  let match = /^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})$/.exec(value);

  if (match) {
    let year = parseInt(match[1], 10);
    let month = parseInt(match[2], 10) - 1;
    let day = parseInt(match[3], 10);

    date = new Date(year, month, day, 23, 59, 59, 999);

    if (isNaN(date.valueOf())) {
      date = undefined;
    }
  }

  return date;
}

function formatDate(value?: Date): string | undefined {
  if (!value) {
    return;
  }

  assert('Invalid date', !isNaN(value.valueOf()));

  let year = pad(value.getFullYear(), 4);
  let month = pad(value.getMonth() + 1, 2);
  let day = pad(value.getDate(), 2);

  return `${year}-${month}-${day}`;
}

function timeout(amount: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, amount);
  });
}

type Slot = [Date, string] | undefined;

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
  ],
  emailAddress: 'jane@example.com',
  emailMessage: 'Hey, I shared a stamp card for you!'
});

export default class StampCardDesignerComponent extends Component<StampCardDesignerArgs> {
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
  @tracked isSubmitted = false;
  @tracked isCanceled = false;

  get isShown(): boolean {
    return !(this.isSubmitted || this.isCanceled);
  }

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

  @tracked _expirationDateValue?: string;

  get expirationDateValue(): string {
    return this._expirationDateValue ||
      formatDate(this.expirationDate) ||
      '';
  }

  set expirationDateValue(value: string) {
    this._expirationDateValue = value;
    this.expirationDate = parseDate(value);
  }

  get expirationDatePlaceholderValue(): string {
    return formatDate(this.placeholders.expirationDate) || '';
  }

  @tracked _termsValue: string | undefined;

  get termsValue(): string {
    return this._termsValue || this.terms.join('\n');
  }

  set termsValue(value: string) {
    this._termsValue = value;

    this.terms = value
      .split('\n')
      .map(v => v.trim())
      .filter(v => v);
  }

  get termsPlaceholderValue(): string {
    return this.placeholders.terms.join('\n');
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

    promise
      .then(() => this.isSubmitted = true)
      .then(() => timeout(500))
      .then(() => this.router.transitionTo('give'))
      .then(() => getOwner(this).lookup('route:give').refresh())
      .catch(Ember.onerror)
  }

  @action cancel(): void {
    this.isCanceled = true;

    timeout(500)
      .then(() => this.router.transitionTo('give'))
      .catch(Ember.onerror);
  }
}
