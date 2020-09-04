import Service from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

type GoogleAuth = gapi.auth2.GoogleAuth;

export type GoogleUser = gapi.auth2.GoogleUser;

export default class SessionService extends Service {
  @tracked currentUser: GoogleUser | null = null;

  private signInPromise!: Promise<GoogleUser>;
  private didSignIn!: (user: GoogleUser) => void;

  constructor() {
    super(...arguments);

    this.resetSignIn();
    this.currentUserDidChange(this.auth.currentUser.get());
    this.auth.currentUser.listen(this.currentUserDidChange);
  }

  async signIn(): Promise<GoogleUser> {
    return this.signInPromise;
  }

  async signOut(): Promise<void> {
    this.auth.signOut();
  }

  private get auth(): GoogleAuth {
    return gapi.auth2.getAuthInstance();
  }

  private resetSignIn(): void {
    this.signInPromise = new Promise(resolve => {
      this.didSignIn = resolve;
    });
  }

  @action private currentUserDidChange(user: GoogleUser): void {
    if (!this.isDestroying) {
      if (user.isSignedIn()) {
        this.currentUser = user;
        this.didSignIn(user);
      } else {
        this.currentUser = null;
        this.resetSignIn();
      }
    }
  }
}
