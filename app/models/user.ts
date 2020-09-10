import DS from 'ember-data';
import Model, { attr, hasMany } from '@ember-data/model';
import { action } from '@ember/object';
import StampCard from './stamp-card';

export default class User extends Model {
  @attr() name!: string;
  @attr() email!: string;
  @attr() picture?: string;

  @hasMany('stamp-card', { inverse: 'from' }) sent!: DS.PromiseManyArray<StampCard>;
  @hasMany('stamp-card', { inverse: 'to' }) received!: DS.PromiseManyArray<StampCard>;

  peekHasMany(key: 'sent' | 'received'): DS.ManyArray<StampCard> | null {
    return this.hasMany(key as any).value();
  }

  get redeemable(): StampCard[] {
    return this.received.filterBy('isLoaded').filterBy('isComplete');
  }

  get collectable() {
    return this.received.filterBy('isLoaded').filterBy('isCollecting');
  }

  get gifted(): StampCard[] {
    return this.sent.filterBy('isLoaded');
  }

  get isRefreshing(): boolean {
    return this.get('isLoading') || this.get('isReloading');
  }

  get isRefreshingSent(): boolean {
    return this.isRefreshing || !this.peekHasMany('sent')?.get('isLoaded');
  }

  get isRefreshingReceived(): boolean {
    return this.isRefreshing || !this.peekHasMany('received')?.get('isLoaded');
  }

  get isRefreshingRedeemable(): boolean {
    return this.isRefreshingReceived;
  }

  get isRefreshingCollectable(): boolean {
    return this.isRefreshingReceived;
  }

  get isRefreshingGifted(): boolean {
    return this.isRefreshingSent;
  }

  @action async refreshSent(): Promise<StampCard[]> {
    if (!this.isRefreshingSent) {
      await this.reload();
    }

    return (await this.sent).toArray();
  }

  @action async refreshReceived(): Promise<StampCard[]> {
    if (!this.isRefreshingReceived) {
      await this.reload();
    }

    return (await this.received).toArray();
  }

  @action async refreshRedeemable(): Promise<StampCard[]> {
    await this.refreshReceived();
    return this.redeemable;
  }

  @action async refreshCollectable(): Promise<StampCard[]> {
    await this.refreshReceived();
    return this.redeemable;
  }

  @action async refreshGifted(): Promise<StampCard[]> {
    await this.refreshSent();
    return this.gifted;
  }
}

declare module 'ember-data/types/registries/model' {
  export default interface ModelRegistry {
    'user': User;
  }
}
