import Route from '@ember/routing/route';
import { onError } from 'stampy/app';
import User from 'stampy/models/user';
import { AuthenticatedTransition } from 'stampy/routes/authenticated';

export default class CollectRoute extends Route {
  model(): User {
    return this.modelFor('authenticated') as User;
  }

  async afterModel(user: User, transition: AuthenticatedTransition): Promise<void> {
    if (user.hasLoadedCollectable) {
      user.refreshCollectable().catch(onError);
    } else {
      await user.refreshCollectable();
    }

    await transition.data.splashScreenDelay;
  }
}
