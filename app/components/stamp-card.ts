import Component from '@glimmer/component';

import Ember from 'ember';
import { getOwner } from '@ember/application';
import { assert } from '@ember/debug';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

import StampCard from 'stampy/models/stamp-card';
import SessionService from 'stampy/services/session';

interface StampCardArgs {
  card?: StampCard;
}

export default class StampCardComponent extends Component<StampCardArgs> {
  @service session!: SessionService;

  get isOwner(): boolean {
    return this.args.card?.from?.get('id') === this.currentUserEmail;
  }

  @action trash(): void {
    let { card } = this.args;

    if (card && confirm('Are you sure?')) {
      card
        .destroyRecord()
        .then(c => c.unloadRecord())
        .then(() => getOwner(this).lookup('route:authenticated').refresh())
        .catch(Ember.onerror);
    }
  }

  private get currentUserEmail(): string {
    assert('Missing currentUser', this.session.currentUser);
    return this.session.currentUser.getBasicProfile().getEmail();
  }
}
