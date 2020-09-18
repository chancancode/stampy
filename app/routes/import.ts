import Route from '@ember/routing/route';
import { assert } from '@ember/debug';
import { inject as service } from '@ember/service';

import config from 'stampy/config/environment';
import ApplicationController from 'stampy/controllers/application';
import SessionService from 'stampy/services/session';

export default class ImportRoute extends Route {
  @service private declare session: SessionService;

  queryParams = {
    q: { refreshModel: true },
    return: { refreshModel: true }
  };

  async model(params: { q?: string, return?: string }): Promise<void> {
    let controller = this.controllerFor('application') as ApplicationController;
    controller.inert = true;

    let token = this.session.token;
    assert('Missing OAuth token', token);

    let view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS);
    view.setMode(google.picker.DocsViewMode.LIST);
    view.setOwnedByMe(false);
    view.setQuery(params.q || 'Stampy');

    let builder = new google.picker.PickerBuilder();
    builder.setAppId(config.GOOGLE_APP_ID);
    builder.setDeveloperKey(config.GOOGLE_API_KEY);
    builder.setOAuthToken(token);
    builder.addView(view);
    builder.enableFeature(google.picker.Feature.MULTISELECT_ENABLED);
    builder.enableFeature(google.picker.Feature.NAV_HIDDEN);
    builder.setSize(window.innerWidth, window.innerHeight);
    builder.hideTitleBar();

    let promise = new Promise<string[]>(resolve => {
      builder.setCallback(({ action, docs }: { action: string, docs?: Array<{ id: string }> }) => {
        if (action === google.picker.Action.PICKED || action === google.picker.Action.CANCEL) {
          resolve((docs || []).map(doc => doc.id));
        }
      });
    });

    let picker = builder.build();
    picker.setVisible(true);

    let ids = await promise;

    controller.inert = false;

    for (let id of ids) {
      try {
        let card = await this.store.findRecord('stamp-card', id);
        this.replaceWith('open', card);
        return;
      } catch {
        // ignore
      }
    }

    this.replaceWith(params.return || '/');
  }
}
