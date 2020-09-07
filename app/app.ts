import Ember from 'ember';
import Application from '@ember/application';
import Resolver from 'ember-resolver';
import loadInitializers from 'ember-load-initializers';
import config from 'stampy/config/environment';

export default class App extends Application {
  modulePrefix = config.modulePrefix;
  podModulePrefix = config.podModulePrefix;
  Resolver = Resolver;
}

Ember.onerror = (error: unknown) => {
  let details: string;

  if (typeof error === 'string') {
    details = error;
  } else if (isError(error)) {
    details = error.stack || `${error.name}: ${error.message}`;
  } else if (isResponse(error)) {
    let status = '';

    if (error.status && error.statusText) {
      status = `${error.status} ${error.statusText}\n\n`;
    } else if (error.status || error.statusText) {
      status = `${error.status || error.statusText}\n\n`;
    }

    details = `${status}${error.body}`;
  } else {
    try {
      details = JSON.stringify(error, null, 2);
    } catch {
      try {
        details = `${error}`;
      } catch {
        details = '';
      }
    }
  }

  let errorDetails = document.getElementById('error-details');

  if (errorDetails) {
    errorDetails.innerText = details;
  }

  let errorModal = document.getElementById('error-modal');

  if (errorModal) {
    errorModal.classList.remove('hide');
    errorModal.classList.add('show');
  }
};

function isPartial<T extends {}>(error: unknown): error is Partial<T> {
  return error && typeof error === 'object';
}

function isError(error: unknown): error is Error {
  return error instanceof Error || (
    isPartial<Error>(error) &&
    typeof error.name === 'string' &&
    typeof error.message === 'string'
  );
}

function isResponse(error: unknown): error is gapi.client.Response<unknown> {
  return isPartial<gapi.client.Response<unknown>>(error) &&
    typeof error.body === 'string';
}

loadInitializers(App, config.modulePrefix);