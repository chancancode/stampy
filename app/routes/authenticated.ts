import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

import SessionService from 'stamps/services/session';

export default class AuthenticatedRoute extends Route {
  @service private session!: SessionService;

  redirect(): void {
    if (this.session.currentUser === null) {
      this.transitionTo('signin');
    }
  }
}
