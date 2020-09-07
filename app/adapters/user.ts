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
  gifted: Link[];
  received: Link[];
}

type File = gapi.client.drive.File;

export default class UserAdapter extends Adapter {
  @service session!: SessionService;

  findRecord<K extends keyof ModelRegistry>(
    _store: Store,
    _type: ModelRegistry[K],
    id: string,
    _snapshot: DS.Snapshot<K>
  ): RSVP.Promise<UserWithLinks> {
    assert(`findRecord with user ${id} is not supported`, this.isCurrentUser(id));
    return RSVP.resolve(this.findCurrentUserWithLinks());
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
    _query: { me: true }
  ): RSVP.Promise<UserWithLinks> {
    return RSVP.resolve(this.findCurrentUserWithLinks());
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
    let { currentUser } = this.session;
    assert('not logged in', currentUser);

    let profile = currentUser.getBasicProfile();
    let name = profile.getName();
    let email = profile.getEmail();
    let picture = profile.getImageUrl();

    return { name, email, picture };
  }

  private async findCurrentUserWithLinks(): Promise<UserWithLinks> {
    let user = this.currentUser;
    let issued: Link[] = [];
    let received: Link[] = [];

    let files = await this.listFiles();

    for (let file of files) {
      assert('Missing id in File', file.id);
      assert('Missing appProperties in File', file.appProperties);
      assert('Missing model in appProperties', 'model' in file.appProperties && file.appProperties.model === 'true');
      assert('Missing type in appProperties', 'type' in file.appProperties);
      assert('Invalid type in appProperties', file.appProperties.type === 'stamp-card');

      let link: Link = {
        type: file.appProperties.type,
        id: file.id
      };

      if (file.ownedByMe) {
        issued.push(link);
      } else {
        received.push(link);
      }
    }

    return {
      ...user,
      gifted: issued,
      received
    };
  }

  private async listFiles(query?: string, pageToken?: string): Promise<File[]> {
    let { result } = await gapi.client.drive.files.list({
      corpora: 'user',
      fields: 'nextPageToken, files(id, ownedByMe, appProperties)',
      pageSize: 1000,
      pageToken,
      q: "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false"
    });

    let files = result.files || [];

    if (result.nextPageToken) {
      return [...files, ...await this.listFiles(query, result.nextPageToken)];
    } else {
      return files;
    }
  }
}
