import { attr, belongsTo } from '@ember-data/model';
import { inject as service } from '@ember/service';

import DS from 'ember-data';
import SpreadsheetModel from './spreadsheet';
import User from './user';
import { sheet } from 'stampy/transforms/sheet';
import SessionService from 'stampy/services/session';

export default class StampCard extends SpreadsheetModel {
  @service declare session: SessionService;

  @attr() declare title: string;
  @attr() declare description: string;
  @attr() declare backgroundColor: string;
  @attr() declare foregroundColor: string;
  @attr() declare goal: number;
  @attr('date') declare expirationDate?: Date;
  @attr() declare terms: readonly string[];

  @sheet(['Date', 'date'], ['Notes', 'string'])
  declare stamps?: readonly [Date, string?][];

  @belongsTo('user', { inverse: 'sent' }) declare from: DS.PromiseObject<User>;
  @belongsTo('user', { inverse: 'received' }) declare to: DS.PromiseObject<User>;

  get isSentFromMe(): boolean {
    return this.session.currentUser?.id === this.from.get('id');
  }

  get isSentToMe(): boolean {
    return !this.isSentFromMe;
  }

  get isCollecting(): boolean {
    return !this.isComplete;
  }

  get isComplete(): boolean {
    return this.filled >= this.goal;
  }

  get filled(): number {
    return this.stamps?.length || 0;
  }
}

declare module 'ember-data/types/registries/model' {
  export default interface ModelRegistry {
    'stamp-card': StampCard;
  }
}
