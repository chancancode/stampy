import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

import config from 'stampy/config/environment';
import SessionService from 'stampy/services/session';

export default class ImportRoute extends Route {
  @service private session!: SessionService;

  queryParams = {
    q: { refreshModel: true }
  };

  async model(params: { q?: string }): Promise<void> {
    let auth = this.session.currentUser!.getAuthResponse();

    let view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS);
    view.setMode(google.picker.DocsViewMode.LIST);
    view.setOwnedByMe(false);
    view.setQuery(params.q || 'Stampy');

    let builder = new google.picker.PickerBuilder();
    builder.setAppId(config.GOOGLE_APP_ID);
    builder.setDeveloperKey(config.GOOGLE_API_KEY);
    builder.setOAuthToken(auth.access_token);
    builder.addView(view);
    builder.enableFeature(google.picker.Feature.MULTISELECT_ENABLED);
    builder.enableFeature(google.picker.Feature.NAV_HIDDEN);
    builder.setSize(window.innerWidth, window.innerHeight);
    builder.hideTitleBar();
    let promise = new Promise(resolve => {
      builder.setCallback(({ action }: { action: string }) => {
        if (action === google.picker.Action.PICKED || action === google.picker.Action.CANCEL) {
          resolve();
        }
      });
    });
    let picker = builder.build();
    picker.setVisible(true);

    await promise;

    this.replaceWith('collect');
  }
}
