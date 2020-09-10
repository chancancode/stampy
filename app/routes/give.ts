import Route from '@ember/routing/route';
import { onError } from 'stampy/app';
import User from 'stampy/models/user';

export default class GiveRoute extends Route {
  model(): User {
    return this.modelFor('authenticated') as User;
  }

  async afterModel(user: User): Promise<void> {
    let promise = user.refreshGifted().catch(onError);

    if (user.gifted.length === 0) {
      await promise;
    }
  }
}
