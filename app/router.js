import EmberRouter from '@ember/routing/router';
import config from 'stampy/config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function() {
  this.route('signin');
  this.route('authenticated', { path: '' }, function() {
    this.route('redeem', { resetNamespace: true });
    this.route('collect', { resetNamespace: true });
    this.route('give', { resetNamespace: true });
    this.route('account', { resetNamespace: true });
  });
});
