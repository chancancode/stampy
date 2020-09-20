import Route from '@ember/routing/route';
import { onError } from 'stampy/app';
import User from 'stampy/models/user';
import { AuthenticatedTransition } from './authenticated';

export default class RedeemRoute extends Route {
  model(): User {
    return this.modelFor('authenticated') as User;
  }

  async afterModel(user: User, transition: AuthenticatedTransition): Promise<void> {
    if (user.hasLoadedRedeemable) {
      user.refreshRedeemable().catch(onError);
    } else {
      await user.refreshRedeemable();
    }

    await transition.data.splashScreenDelay;
  }
}
