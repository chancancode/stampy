import DS from 'ember-data';
import Model, { attr, hasMany } from '@ember-data/model';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import StampCard from './stamp-card';

export default class User extends Model {
  @attr() declare name: string;
  @attr() declare email: string;
  @attr() declare picture: string;

  @hasMany('stamp-card', { inverse: 'from' }) declare sent: DS.PromiseManyArray<StampCard>;
  @hasMany('stamp-card', { inverse: 'to' }) declare received: DS.PromiseManyArray<StampCard>;

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

  @tracked hasLoadedSent = false;
  @tracked hasLoadedReceived = false;

  get hasLoadedRedeemable(): boolean {
    return this.hasLoadedReceived;
  }

  get hasLoadedCollectable(): boolean {
    return this.hasLoadedReceived;
  }

  get hasLoadedGifted(): boolean {
    return this.hasLoadedSent;
  }

  get isRefreshingSent(): boolean {
    return this.isRefreshing || !this.hasLoadedSent || this.sent.get('isPending');
  }

  get isRefreshingReceived(): boolean {
    return this.isRefreshing || !this.hasLoadedReceived || this.received.get('isPending');
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

    let result = await this.sent;
    this.hasLoadedSent = true;

    return result.toArray();
  }

  @action async refreshReceived(): Promise<StampCard[]> {
    if (!this.isRefreshingReceived) {
      await this.reload();
    }

    let result = await this.received;
    this.hasLoadedReceived = true;

    return result.toArray();
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
