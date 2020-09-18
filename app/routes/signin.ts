import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

import { onError } from 'stampy/app';
import SessionService from 'stampy/services/session';

export default class SignInRoute extends Route {
  queryParams = {
    return: { refreshModel: true }
  };

  @service private declare session: SessionService;

  private return: string = '/';

  model(params: { return?: string }): void {
    this.return = params.return || '/';
  }

  activate(): void {
    this.session.signIn()
      .then(() => { this.transitionTo(this.return) })
      .catch(onError);
  }
}
