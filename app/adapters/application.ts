import Adapter from '@ember-data/adapter';
import Store from '@ember-data/store';
import DS from 'ember-data';
import ModelRegistry from 'ember-data/types/registries/model';
import { assert } from '@ember/debug';
import RSVP from 'rsvp';

import { CreateSpreadsheet, UpdateSpreadsheet } from 'stampy/serializers/application';

function timeout(amount: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, amount);
  });
}

type Request<T> = gapi.client.Request<T>;
type Response<T> = gapi.client.Response<T>;
type Permission = gapi.client.drive.Permission;
type User = gapi.client.drive.User;
type File = gapi.client.drive.File;
type Spreadsheet = gapi.client.sheets.Spreadsheet;

export const SPREADSHEET_Q = "appProperties has { key='model' and value='true' } and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false";
export const FOLDER_Q = "appProperties has { key='root' and value='true' } and mimeType = 'application/vnd.google-apps.folder' and trashed = false";

// Same as SPREADSHEET_Q
export function isValidFile(file: File): boolean {
  return file.appProperties?.model === 'true' &&
    file.mimeType === 'application/vnd.google-apps.spreadsheet' &&
    file.trashed !== true;
}

export type RecordFile = {
  id: string;
  appProperties: Record<string, string>;
  ownedByMe: true;
  permissions: Permission[];
} | {
  id: string;
  appProperties: Record<string, string>;
  ownedByMe: false;
  sharingUser: User;
};

export interface AdapterRecord {
  file: RecordFile;
  spreadsheet: Spreadsheet;
}

export interface SharingOptions {
  emailAddress: string;
  emailMessage?: string;
  sendNotificationEmail?: boolean;
}

export default class ApplicationAdapter extends Adapter {
  // HACK: The list API is sometimes delayed in returning recently created or
  // imported files in the response, causing records we know about to vanish.
  // The get API does not have this issue, so we keep a list of recently seen
  // IDs and suppliment the list response with these if needed.
  private recentlySeenIds: Set<string> = new Set();

  private requests: Set<Request<unknown>> = new Set();

  findRecord<K extends keyof ModelRegistry>(
    _store: Store,
    _type: ModelRegistry[K],
    id: string,
    _snapshot: DS.Snapshot<K>
  ): RSVP.Promise<AdapterRecord> {
    return RSVP.resolve(this.find(id));
  }

  findAll<K extends keyof ModelRegistry>(
    _store: Store,
    _type: ModelRegistry[K],
    _sinceToken: string,
    _snapshotRecordArray: DS.SnapshotRecordArray<K>
  ): RSVP.Promise<AdapterRecord[]> {
    return RSVP.resolve(this.findAllByQuery(SPREADSHEET_Q));
  }

  query<K extends keyof ModelRegistry>(
    _store: Store,
    _type: ModelRegistry[K],
    query: string,
    _recordArray: DS.AdapterPopulatedRecordArray<any>
  ): RSVP.Promise<AdapterRecord[]> {
    return RSVP.resolve(this.findAllByQuery(`(${query}) and (${SPREADSHEET_Q})`));
  }

  queryRecord<K extends keyof ModelRegistry>(
    _store: Store,
    _type: ModelRegistry[K],
    query: string
  ): RSVP.Promise<AdapterRecord | undefined> {
    return RSVP.resolve(this.findByQuery(`(${query}) and (${SPREADSHEET_Q})`));
  }

  createRecord<K extends keyof ModelRegistry>(
    _store: Store,
    _type: ModelRegistry[K],
    snapshot: DS.Snapshot<K>
  ): RSVP.Promise<AdapterRecord> {
    return RSVP.resolve(this.create(snapshot));
  }

  updateRecord<K extends keyof ModelRegistry>(
    _store: Store,
    _type: ModelRegistry[K],
    snapshot: DS.Snapshot<K>
  ): RSVP.Promise<AdapterRecord> {
    return RSVP.resolve(this.update(snapshot));
  }

  deleteRecord<K extends keyof ModelRegistry>(
    _store: Store,
    _type: ModelRegistry[K],
    snapshot: DS.Snapshot<K>
  ): RSVP.Promise<void> {
    return RSVP.resolve(this.deleteFile(snapshot.id));
  }

  private async find(id: string): Promise<AdapterRecord>;
  private async find(file: RecordFile): Promise<AdapterRecord>;
  private async find(locator: string | RecordFile): Promise<AdapterRecord> {
    let file: RecordFile;

    if (typeof locator === 'string') {
      file = await this.findFileById(locator);
    } else {
      file = locator;
    }

    let spreadsheet = await this.findSpreadsheet(file.id);

    return { file, spreadsheet };
  }

  private async findByQuery(query: string): Promise<AdapterRecord | undefined> {
    let file = await this.findFileByQuery(query);

    if (file?.id) {
      assert('Missing ownedByMe in File', typeof file.ownedByMe === 'boolean');
      assert('Missing permissions in File', !file.ownedByMe || Array.isArray(file.permissions));
      assert('Missing sharingUser in File', file.ownedByMe || file.sharingUser);

      let spreadsheet = await this.findSpreadsheet(file.id);

      return { file, spreadsheet };
    } else {
      return undefined;
    }
  }

  private async findAllByQuery(query: string): Promise<AdapterRecord[]> {
    let files = await this.listFiles(query);

    return Promise.all(files.map(async file => {
      let spreadsheet = await this.findSpreadsheet(file.id);

      return { file, spreadsheet };
    }));
  }

  private async create<K extends keyof ModelRegistry>(
    snapshot: DS.Snapshot<K>
  ): Promise<AdapterRecord> {
    let serialized = this.serialize(snapshot, { mode: 'create' }) as CreateSpreadsheet;
    let spreadsheet = await this.createSpreadsheet(serialized);

    assert('Missing spreadsheetId in Spreadsheet', spreadsheet.spreadsheetId);

    let fileId = spreadsheet.spreadsheetId;
    let description = `Open in the Stampy app at https://stampy.netlify.app/open/${fileId}`;

    if (snapshot.adapterOptions) {
      let { emailAddress, emailMessage, sendNotificationEmail } = snapshot.adapterOptions as SharingOptions;

      if (sendNotificationEmail) {
        if (emailMessage) {
          emailMessage = `${emailMessage} ${description}`;
        } else {
          emailMessage = description;
        }
      }

      await this.request(() =>
        gapi.client.drive.permissions.create({
          fileId,
          sendNotificationEmail,
          emailMessage,
          resource: {
            type: 'user',
            role: 'commenter',
            emailAddress
          }
        })
      );
    }

    let parentId = (await this.findFileByQuery(FOLDER_Q))?.id;

    if (!parentId) {
      let { result } = await this.request(() =>
        gapi.client.drive.files.create({
          fields: 'id',
          resource: {
            appProperties: {
              root: 'true'
            },
            name: 'Stampy',
            description: 'View on the Stampy app at https://stampy.netlify.app/give',
            mimeType: 'application/vnd.google-apps.folder'
          }
        })
      );

      assert('Missing id in File', result.id);

      parentId = result.id;
    }

    let { result: file } = await this.request(() =>
      gapi.client.drive.files.update({
        fileId,
        fields: 'id, appProperties, ownedByMe, permissions, sharingUser',
        addParents: parentId,
        resource: {
          appProperties: {
            model: 'true',
            type: snapshot.modelName
          },
          description
        }
      })
    );

    this.recentlySeenIds.add(fileId);

    return { file: file as RecordFile, spreadsheet };
  }

  private async update<K extends keyof ModelRegistry>(
    snapshot: DS.Snapshot<K>
  ): Promise<AdapterRecord> {
    let serialized = this.serialize(snapshot, { mode: 'update' }) as UpdateSpreadsheet;

    if (serialized.requests.length === 0) {
      return this.find(serialized.spreadsheetId);
    }

    let file = this.findFileById(serialized.spreadsheetId);
    let spreadsheet = this.updateSpreadsheet(serialized);

    return {
      file: await file,
      spreadsheet: await spreadsheet
    };
  }

  private async findFileById(fileId: string, validate = true): Promise<RecordFile> {
    let { result: file, body } = await this.request(() =>
      gapi.client.drive.files.get({
       fileId,
        fields: 'id, appProperties, mimeType, trashed, ownedByMe, permissions, sharingUser'
      })
    );

    if (validate) {
      assert(`Invalid file:\n${body}`, isValidFile(file));
      this.recentlySeenIds.add(fileId);
    }

    return file as RecordFile;
  }

  private async findFileByQuery(q: string): Promise<RecordFile | undefined> {
    return (await this.listFiles(q))[0];
  }

  // used by user adapter
  async listFiles(q: string = SPREADSHEET_Q, pageToken?: string): Promise<RecordFile[]> {
    let { result } = await this.request(() =>
      gapi.client.drive.files.list({
        corpora: 'user',
        fields: 'nextPageToken, files(id, appProperties, mimeType, trashed, ownedByMe, permissions, sharingUser)',
        pageSize: 1000,
        pageToken,
        q
      })
    );

    let files = result.files as RecordFile[] || [];

    if (result.nextPageToken) {
      return [...files, ...await this.listFiles(q, result.nextPageToken)];
    } else if (q !== SPREADSHEET_Q) {
      return files;
    } else {
      let ids = files.map(file => file.id);

      files = files.filter(isValidFile);

      for (let fileId of this.recentlySeenIds) {
        if (!ids.includes(fileId)) {
          try {
            let file = await this.findFileById(fileId, false);

            if (isValidFile(file)) {
              files.unshift(file);
            } else {
              this.recentlySeenIds.delete(fileId);
            }
          } catch {
            // ignore
          }
        }
      }

      return files;
    }
  }

  private async deleteFile(fileId: string): Promise<void> {
    await this.request(() =>
      gapi.client.drive.files.update({ fileId, resource: { trashed: true } })
    );

    this.recentlySeenIds.delete(fileId);
  }

  private async findSpreadsheet(id: string): Promise<Spreadsheet> {
    let { result: spreadsheet } = await this.request(() =>
      gapi.client.sheets.spreadsheets.get({
        spreadsheetId: id,
        includeGridData: true,
      })
    );

    return spreadsheet;
  }

  private async createSpreadsheet(resource: CreateSpreadsheet): Promise<Spreadsheet> {
    let { result: { spreadsheetId } } = await this.request(() =>
      gapi.client.sheets.spreadsheets.create({
        fields: 'spreadsheetId',
        resource
      })
    );

    assert('spreadsheetId missing', spreadsheetId);

    // The returned spreadsheet does not include the grid data
    return this.findSpreadsheet(spreadsheetId);
  }

  private async updateSpreadsheet({ spreadsheetId, requests }: UpdateSpreadsheet): Promise<Spreadsheet> {
    let { result } = await this.request(() =>
      gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests,
          includeSpreadsheetInResponse: true,
          responseIncludeGridData: true
        }
      })
    );

    return result.updatedSpreadsheet!;
  }

  private async request<T>(callback: () => Request<T>, retries = 5): Promise<Response<T>> {
    while (this.requests.size > 10) {
      try {
        await Promise.race(this.requests);
      } catch {
        // ignore
      }
    }

    let request = callback();

    this.requests.add(request);

    try {
      return await request;
    } catch(error) {
      if (retries > 1 && error?.status === 429) {
        let delay = Math.round(1000 + Math.random() * (Math.pow(100, 1 / retries) - 1) * 1000);
        console.log(`429 Rate Limited: ${retries - 1} retries left, trying again in ${delay}ms`);
        await timeout(delay);
        return this.request(callback, retries - 1);
      } else {
        if (error?.status === 429) {
          console.warn('Giving up');
        }
        throw error;
      }
    } finally {
      this.requests.delete(request);
    }
  }
}

declare module 'ember-data/types/registries/adapter' {
  export default interface AdapterRegistry {
    'application': ApplicationAdapter;
  }
}
