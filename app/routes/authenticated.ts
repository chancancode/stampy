import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

import SessionService from 'stampy/services/session';
import User from 'stampy/models/user';

export default class AuthenticatedRoute extends Route {
  @service private declare session: SessionService;

  model(): User | void {
    if (this.session.currentUser === null) {
      this.transitionTo('signin', {
        queryParams: { return: this.attemptedURL }
      });
    } else {
      return this.session.currentUser;
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
