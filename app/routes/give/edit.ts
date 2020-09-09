import Route from '@ember/routing/route';
import StampCard from 'stampy/models/stamp-card';

export default class GiveEditRoute extends Route {
  async model(params: { id: string }): Promise<StampCard> {
    return this.store.findRecord('stamp-card', params.id);
  }
}
