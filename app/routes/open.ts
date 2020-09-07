import Route from '@ember/routing/route';

export default class OpenRoute extends Route {
  async model({ id }: { id: string }): Promise<void> {
    try {
      let card = await this.store.findRecord('stamp-card', id);
      let user = await this.store.queryRecord('user', { me: true });

      if ((await card.from).id === user.id) {
        this.transitionTo('give');
      } else {
        this.transitionTo('collect');
      }
    } catch {
      this.transitionTo('import', { queryParams: { q: id } });
    }
  }
}
