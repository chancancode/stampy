import { attr, belongsTo } from '@ember-data/model';

import { assert } from '@ember/debug';

import DS from 'ember-data';
import SpreadsheetModel from './spreadsheet';
import User from './user';
import { sheet } from 'stampy/transforms/sheet';

export default class StampCard extends SpreadsheetModel {
  @attr() title!: string;
  @attr() description!: string;
  @attr() backgroundColor!: string;
  @attr() foregroundColor!: string;
  @attr() goal!: number;
  @attr('date') expirationDate?: Date;
  @attr() terms!: readonly string[];

  @sheet(['Date', 'date'], ['Notes', 'string'])
  stamps?: readonly [Date, string?][];

  @belongsTo('user', { inverse: 'gifted' }) from!: DS.PromiseObject<User>;
  @belongsTo('user', { inverse: 'received' }) to!: DS.PromiseObject<User>;

  get slots(): readonly ([Date, string?] | undefined)[] {
    let { goal, stamps } = this;

    stamps = stamps || [];

    assert(
      `Too many stamps, expected ${goal}, got ${stamps.length}`,
      goal >= stamps.length
    );

    let filled = stamps.map(([date, notes]) => ({ date, notes }));
    let empty = new Array(goal - stamps.length);

    return [...filled, ...empty];
  }
}

declare module 'ember-data/types/registries/model' {
  export default interface ModelRegistry {
    'stamp-card': StampCard;
  }
}
