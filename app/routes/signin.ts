import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

import SessionService from 'stamps/services/session';

export default class SignInRoute extends Route {
  @service private session!: SessionService;

  activate(): void {
    this.session.signIn().then(() => {
      this.transitionTo('collect');
    });
  }
}
