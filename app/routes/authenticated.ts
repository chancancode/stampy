import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

import SessionService from 'stampy/services/session';
import User from 'stampy/models/user';

function timeout(amount: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, amount);
  });
}

type Transition = Parameters<Route['beforeModel']>[0];

export interface AuthenticatedTransition extends Transition {
  data: {
    splashScreenDelay?: Promise<void>
  };
}

export default class AuthenticatedRoute extends Route {
  @service private declare session: SessionService;

  beforeModel(transition: AuthenticatedTransition): void {
    transition.data.splashScreenDelay = timeout(2500);
  }

  async model(_: {}, transition: AuthenticatedTransition): Promise<User | void> {
    let user = await Promise.race([
      transition.data.splashScreenDelay,
      this.session.signIn()
    ]);

    if (user) {
      return user;
    } else {
      this.transitionTo('signin', {
        queryParams: { return: this.attemptedURL }
      });
    }
  }

  private get attemptedURL(): string | undefined {
    let url = location.href.slice(location.origin.length);

    if (url.startsWith('/signin') || url.startsWith('/signout')) {
      return;
    } else {
      return url;
    }
  }
}
