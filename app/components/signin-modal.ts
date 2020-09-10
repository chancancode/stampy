import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

import SessionService from 'stampy/services/session';

export default class SigninModalComponent extends Component {
  @service declare session: SessionService;

  @action renderGoogleSignin(element: HTMLDivElement): void {
    gapi.signin2.render(element, { longtitle: true });
  }
}
