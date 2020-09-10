import Adapter from '@ember-data/adapter';
import Store from '@ember-data/store';
import DS from 'ember-data';
import ModelRegistry from 'ember-data/types/registries/model';
import { assert } from '@ember/debug';
import { inject as service } from '@ember/service';
import RSVP from 'rsvp';

import SessionService from 'stampy/services/session';

export interface Link {
  type: Exclude<keyof ModelRegistry, 'user'>;
  id: string;
}

export interface User {
  name: string;
  email: string;
  picture?: string;
}

export interface UserWithLinks extends User {
  sent: Link[];
  received: Link[];
}


export default class UserAdapter extends Adapter {
  @service private declare session: SessionService;

  // HACK: The list API is sometimes delayed in returning recently created or
  // imported files in the response, causing records we know about to vanish.
  // The get API does not have this issue, so we keep a list of recently seen
  // IDs and suppliment the list response with these if needed.
  recentlySeenIds: string[] = [];

  findRecord<K extends keyof ModelRegistry>(
    store: Store,
    _type: ModelRegistry[K],
    id: string,
    _snapshot: DS.Snapshot<K>
  ): RSVP.Promise<UserWithLinks> {
    assert(`findRecord with user ${id} is not supported`, this.isCurrentUser(id));
    return RSVP.resolve(this.findCurrentUserWithLinks(store));
  }

  findAll<K extends keyof ModelRegistry>(
    _store: Store,
    _type: ModelRegistry[K],
    _sinceToken: string,
    _snapshotRecordArray: DS.SnapshotRecordArray<K>
  ): never {
    assert('findAll is not supported');
  }

  query<K extends keyof ModelRegistry>(
    _store: Store,
    _type: ModelRegistry[K],
    _query: string,
    _recordArray: DS.AdapterPopulatedRecordArray<any>
  ): never {
    assert('query is not supported');
  }

  queryRecord<K extends keyof ModelRegistry>(
    _store: Store,
    _type: ModelRegistry[K],
    _query: string
  ): RSVP.Promise<UserWithLinks> {
    assert('queryRecord is not supported');
  }

  createRecord<K extends keyof ModelRegistry>(
    _store: Store,
    _type: ModelRegistry[K],
    _snapshot: DS.Snapshot<K>
  ): never {
    assert('createRecord is not supported');
  }

  updateRecord<K extends keyof ModelRegistry>(
    _store: Store,
    _type: ModelRegistry[K],
    _snapshot: DS.Snapshot<K>
  ): never {
    assert('updateRecord is not supported');
  }

  deleteRecord<K extends keyof ModelRegistry>(
    _store: Store,
    _type: ModelRegistry[K],
    _snapshot: DS.Snapshot<K>
  ): never {
    assert('deleteRecord is not supported');
  }

  shouldReloadRecord<K extends keyof ModelRegistry>(
    _store: Store,
    snapshot: DS.Snapshot<K>
  ): boolean {
    return this.isCurrentUser(snapshot.id);
  }

  shouldReloadAll(): false {
    return false;
  }

  shouldBackgroundReloadRecord(): false {
    return false;
  }

  shouldBackgroundReloadAll(): false {
    return false;
  }

  private isCurrentUser(id: string): boolean {
    return this.currentUser.email === id;
  }

  private get currentUser(): User {
    let { profile } = this.session;
    assert('not logged in', profile);

    let name = profile.getName();
    let email = profile.getEmail();
    let picture = profile.getImageUrl();

    return { name, email, picture };
  }

  private async findCurrentUserWithLinks(store: Store): Promise<UserWithLinks> {
    let user = this.currentUser;
    let sent: Link[] = [];
    let received: Link[] = [];

    let files = await store.adapterFor('application').listFiles();

    for (let file of files) {
      assert('Missing type in appProperties', 'type' in file.appProperties);
      assert('Invalid type in appProperties', file.appProperties.type === 'stamp-card');

      let link: Link = {
        type: file.appProperties.type,
        id: file.id
      };

      if (file.ownedByMe) {
        sent.push(link);
      } else {
        received.push(link);
      }
    }

    return { ...user, sent, received };
  }
}

declare module 'ember-data/types/registries/adapter' {
  export default interface AdapterRegistry {
    'user': UserAdapter;
  }
}
