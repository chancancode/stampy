import Route from '@ember/routing/route';
import User from 'stampy/models/user';

export default class AccountRoute extends Route {
  async model(): Promise<User> {
    return this.store.queryRecord('user', { me: true });
  }
}
