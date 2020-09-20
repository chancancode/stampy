import Route from '@ember/routing/route';
import { onError } from 'stampy/app';
import User from 'stampy/models/user';
import { AuthenticatedTransition } from './authenticated';

export default class GiveRoute extends Route {
  model(): User {
    return this.modelFor('authenticated') as User;
  }

  async afterModel(user: User, transition: AuthenticatedTransition): Promise<void> {
    if (user.hasLoadedGifted) {
      user.refreshGifted().catch(onError);
    } else {
      await user.refreshGifted();
    }

    await transition.data.splashScreenDelay;
  }
}
