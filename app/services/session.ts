import Ember from 'ember';
import Service, { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import Store from '@ember-data/store';

import User from 'stampy/models/user';

type GoogleAuth = gapi.auth2.GoogleAuth;
type GoogleUser = gapi.auth2.GoogleUser;
export type GoogleProfile = gapi.auth2.BasicProfile;

function timeout(amount: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, amount);
  });
}

export default class SessionService extends Service {
  @service declare store: Store;

  @tracked profile: GoogleProfile | null = null;
  @tracked currentUser: User | null = null;

  private signInPromise!: Promise<User>;
  private didSignIn!: (user: User) => void;

  constructor() {
    super(...arguments);

    this.resetSignIn();
    this.currentUserDidChange(this.auth.currentUser.get());
    this.auth.currentUser.listen(this.currentUserDidChange);
  }

  async signIn(): Promise<User> {
    return this.signInPromise;
  }

  async signOut(): Promise<void> {
    // This doesn't seem to actually wait for the signout?
    await this.auth.signOut();

    // TODO: replace this HAX with something better?
    while (this.profile) {
      await timeout(50);
    }
  }

  get token(): string | null {
    return this.auth.currentUser.get().getAuthResponse().access_token;
  }

  private get auth(): GoogleAuth {
    return gapi.auth2.getAuthInstance();
  }

  private resetSignIn(): void {
    let promise = this.signInPromise = new Promise(resolve => {
      this.didSignIn = (user: User) => {
        if (this.signInPromise === promise) {
          this.currentUser = user;
        }

        resolve(user);
      };
    });
  }

  @action private currentUserDidChange(user: GoogleUser): void {
    if (!this.isDestroying) {
      if (user.isSignedIn()) {
        let profile = this.profile = user.getBasicProfile();
        this.store.findRecord('user', profile.getEmail()).then(
          this.didSignIn,
          Ember.onerror
        );
      } else {
        this.profile = null;
        this.currentUser = null;
        this.resetSignIn();
      }
    }
  }
}
