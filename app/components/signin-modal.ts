import Component from '@glimmer/component';
import { action } from '@ember/object';
export default class SigninModalComponent extends Component {
  @action renderGoogleSignin(element: HTMLDivElement): void {
    gapi.signin2.render(element, { longtitle: true });
  }
}
