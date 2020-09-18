import Ember from 'ember';
import Application from '@ember/application';
import Resolver from 'ember-resolver';
import loadInitializers from 'ember-load-initializers';
import 'inert-polyfill';

import config from 'stampy/config/environment';

export default class App extends Application {
  modulePrefix = config.modulePrefix;
  podModulePrefix = config.podModulePrefix;
  Resolver = Resolver;
}

export function onError(error: unknown): void {
  let details: string;

  if (typeof error === 'string') {
    details = error;
  } else if (isError(error)) {
    if (isBenign(error)) {
      return;
    }

    details = error.name || 'Error';

    if (error.message) {
      details = `${details}: ${error.message}`;
    }

    if (error.stack) {
      if (error.stack.startsWith(`${details}`)) {
        details = error.stack;
      } else {
        details = `${details}\n${error.stack}`;
      }
    }
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

  let errorDetails = document.getElementById('error-details') as HTMLTextAreaElement | null;

  if (errorDetails) {
    errorDetails.value = details;
  }

  const errorModal = document.getElementById('error-modal');

  if (errorModal) {
    errorModal.setAttribute('style', '');
    setTimeout(() => errorModal.classList.add('show'), 0);

    let app = document.getElementById('app');

    if (app) {
      app.inert = true;
      app.setAttribute('aria-hidden', 'true');
    }
  }

  console.error(error);
}

Ember.onerror = onError;
Ember.RSVP.on('error', onError);

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

function isBenign(error: Error): boolean {
  return error.name === 'TransitionAborted';
}

loadInitializers(App, config.modulePrefix);
