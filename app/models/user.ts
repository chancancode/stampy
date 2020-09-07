import DS from 'ember-data';
import Model, { attr, hasMany } from '@ember-data/model';
import StampCard from './stamp-card';

export default class User extends Model {
  @attr() name!: string;
  @attr() email!: string;
  @attr() picture?: string;
  @hasMany('stamp-card', { inverse: 'from' }) gifted!: DS.PromiseManyArray<StampCard>;
  @hasMany('stamp-card', { inverse: 'to' }) received!: DS.PromiseManyArray<StampCard>;
}

declare module 'ember-data/types/registries/model' {
  export default interface ModelRegistry {
    'user': User;
  }
}
