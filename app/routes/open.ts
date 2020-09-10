import Route from '@ember/routing/route';
import StampCard from 'stampy/models/stamp-card';

export default class OpenRoute extends Route {
  async model({ id }: { id: string }): Promise<StampCard | void> {
    try {
      return await this.store.findRecord('stamp-card', id);
    } catch {
      this.transitionTo('import', { queryParams: { q: id } });
    }
  }

  afterModel(card: StampCard): void {
    if (card.isSentFromMe) {
      this.transitionTo('give');
    } else {
      this.transitionTo('collect');
    }
  }
}
