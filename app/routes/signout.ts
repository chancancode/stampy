import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

import SessionService from 'stampy/services/session';

export default class SignOutRoute extends Route {
  @service private session!: SessionService;

  async beforeModel(): Promise<void> {
    await this.session.signOut();
    this.store.unloadAll();
    this.replaceWith('signin');
  }
}
