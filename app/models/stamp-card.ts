import { attr, belongsTo } from '@ember-data/model';
import { runInDebug } from '@ember/debug';
import { inject as service } from '@ember/service';

import DS from 'ember-data';
import SpreadsheetModel from './spreadsheet';
import User from './user';
import { sheet } from 'stampy/transforms/sheet';
import SessionService from 'stampy/services/session';

function debugFreeze<T extends readonly unknown[]>(array: T): Readonly<T> {
  runInDebug(() => {
    array = Object.freeze([...array]) as T;
  });

  return array;
}

const EMPTY_ROW = debugFreeze([] as const);

type RowData = readonly [Date?, string?];

function sortedRows(rows: readonly RowData[]): RowData[] {
  return [...rows].sort((lhs, rhs) => {
    let vlhs = lhs[0]?.valueOf() || Infinity;
    let vrhs = rhs[0]?.valueOf() || Infinity;

    if (vlhs < vrhs) {
      return -1;
    } else if (vlhs > vrhs) {
      return 1;
    } else {
      return 0;
    }
  });
}

export interface Stamp {
  date: Date;
  note?: string;
}

export default class StampCard extends SpreadsheetModel {
  @service declare session: SessionService;

  @attr() declare title: string;
  @attr() declare description: string;
  @attr() declare backgroundColor: string;
  @attr() declare foregroundColor: string;
  @attr() declare goal: number;
  @attr('date') declare expirationDate?: Date;
  @attr() declare terms: readonly string[];

  @sheet('stamps', ['Date', 'date'], ['Notes', 'string'])
  declare private _stamps?: readonly RowData[];

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

  get stamps(): readonly Stamp[] {
    return debugFreeze(
      sortedRows(this._stamps || EMPTY_ROW)
        .filter(row => row.length > 0)
        .map(([date, note]) => ({
          date: date!,
          note
        }))
    );
  }

  set stamps(value: readonly Stamp[]) {
    let rows: RowData[] = value.map(stamp => {
      if (stamp.note) {
        return debugFreeze([stamp.date, stamp.note]);
      } else {
        return debugFreeze([stamp.date]);
      }
    });

    while (rows.length < this.goal) {
      rows.push(EMPTY_ROW);
    }

    this._stamps = debugFreeze(sortedRows(rows));
  }

  get filled(): number {
    return this.stamps.length;
  }
}

declare module 'ember-data/types/registries/model' {
  export default interface ModelRegistry {
    'stamp-card': StampCard;
  }
}
