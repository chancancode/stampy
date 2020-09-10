import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

import SessionService from 'stampy/services/session';
import User from 'stampy/models/user';

export default class AuthenticatedRoute extends Route {
  @service private declare session: SessionService;

  private returnTo?: string;

  model(): User | void {
    if (this.session.currentUser === null) {
      this.returnTo = this.attemptedURL;
      this.transitionTo('signin');
    } else {
      return this.session.currentUser;
    }
  }

  afterModel(): void {
    if (this.returnTo) {
      let { returnTo } = this;
      this.returnTo = undefined;
      this.replaceWith(returnTo);
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
