import Route from '@ember/routing/route';
import { assert } from '@ember/debug';
import config from 'stampy/config/environment';

export default class ApplicationRoute extends Route {
  async beforeModel(): Promise<void> {
    assert('Missing GOOGLE_API_KEY', config.GOOGLE_API_KEY);
    assert('Missing GOOGLE_CLIENT_ID', config.GOOGLE_CLIENT_ID);

    await window.scripts.platform;

    await new Promise(resolve => {
      gapi.load('client:auth2:picker', resolve);
    });

    await gapi.client.init({
      apiKey: config.GOOGLE_API_KEY,
      clientId: config.GOOGLE_CLIENT_ID,
      discoveryDocs: [
        'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
        'https://www.googleapis.com/discovery/v1/apis/sheets/v4/rest'
      ],
      scope: [
        'email',
        'profile',
        'https://www.googleapis.com/auth/drive.file'
      ].join(' ')
    });
  }
}
