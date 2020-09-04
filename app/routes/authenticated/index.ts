import Route from '@ember/routing/route';

export default class AuthenticatedIndexRoute extends Route {
  redirect(): void {
    this.replaceWith('redeem');
  }
}
