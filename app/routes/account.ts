import Route from '@ember/routing/route';
import User from 'stampy/models/user';

export default class AccountRoute extends Route {
  model(): User {
    return this.modelFor('authenticated') as User;
  }
}
