import Route from '@ember/routing/route';
import Spreadsheet from 'stamps/models/spreadsheet';

export default class CollectRoute extends Route {
  async model(): Promise<Spreadsheet[]> {
    return (await this.store.findAll('stamp-card')).toArray();
  }
}
