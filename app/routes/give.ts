import Route from '@ember/routing/route';
import StampCard from 'stampy/models/stamp-card';

export default class GiveRoute extends Route {
  async model(): Promise<StampCard[]> {
    let user = await this.store.queryRecord('user', { me: true });
    let model = await user.gifted;
    return model.toArray();
  }
}
