import Service from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

type GoogleAuth = gapi.auth2.GoogleAuth;

export type GoogleUser = gapi.auth2.GoogleUser;

function timeout(amount: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, amount);
  });
}

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
    // This doesn't seem to actually wait for the signout?
    await this.auth.signOut();

    // TODO: replace this HAX with something better?
    while (this.currentUser) {
      await timeout(50);
    }
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
