import Component from '@glimmer/component';
import User from 'stampy/models/user';

interface ProfileArgs {
  user: User;
}

export default class ProfileComponent extends Component<ProfileArgs> {
  get initial() {
    return this.args.user.name.slice(0, 1).toUpperCase();
  }
}
