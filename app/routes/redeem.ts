import Route from '@ember/routing/route';

export default class RedeemRoute extends Route {
  async beforeModel(): Promise<unknown> {
    let auth = gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse();
    let config = require('stampy/config/environment').default;
    let view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS);
    view.setMode(google.picker.DocsViewMode.LIST);
    view.setOwnedByMe(false);
    view.setQuery('Stampy');
    // view.setParent('1YK5K1yPNWXrMFPsnSwC6UpHGGdQ8aQhD');
    // view.setParent('15FbUI0vmSFI3uqZdlHknuBEWv0v_nxL0PXl9PGo1S3U');
    let builder = new google.picker.PickerBuilder();
    builder.setAppId('394800014115');
    builder.setDeveloperKey(config.GOOGLE_API_KEY);
    builder.setOAuthToken(auth.access_token);
    builder.addView(view);
    builder.enableFeature(google.picker.Feature.MULTISELECT_ENABLED);
    builder.enableFeature(google.picker.Feature.NAV_HIDDEN);
    builder.setSize(Math.min(window.innerWidth, 1051), Math.min(window.innerHeight, 650));
    builder.hideTitleBar();
    let promise = new Promise(resolve => {
      builder.setCallback(resolve);
    });
    let picker = builder.build();
    picker.setVisible(true);

    return promise;
  }
}
