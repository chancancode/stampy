import Adapter from '@ember-data/adapter';
import Store from '@ember-data/store';
import DS from 'ember-data';
import ModelRegistry from 'ember-data/types/registries/model';
import { assert } from '@ember/debug';
import RSVP from 'rsvp';

import { CreateSpreadsheet, UpdateSpreadsheet } from 'stampy/serializers/application';

type Permission = gapi.client.drive.Permission;
type User = gapi.client.drive.User;
type Spreadsheet = gapi.client.sheets.Spreadsheet;

export const SPREADSHEET_Q = "appProperties has { key='model' and value='true' } and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false";
export const FOLDER_Q = "appProperties has { key='root' and value='true' } and mimeType = 'application/vnd.google-apps.folder' and trashed = false";

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

      await gapi.client.drive.permissions.create({
        fileId,
        sendNotificationEmail,
        emailMessage,
        resource: {
          type: 'user',
          role: 'commenter',
          emailAddress
        }
      });
    }

    let parentId = (await this.findFileByQuery(FOLDER_Q))?.id;

    if (!parentId) {
      let { result } = await gapi.client.drive.files.create({
        fields: 'id',
        resource: {
          appProperties: {
            root: 'true'
          },
          name: 'Stampy',
          description: 'View on the Stampy app at https://stampy.netlify.app/give',
          mimeType: 'application/vnd.google-apps.folder'
        }
      });

      assert('Missing id in File', result.id);

      parentId = result.id;
    }

    let { result: file } = await gapi.client.drive.files.update({
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
    });

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

  private async findFileById(fileId: string): Promise<RecordFile> {
    let { result } = await gapi.client.drive.files.get({
      fileId,
      fields: 'id, ownedByMe, permissions, sharingUser'
    });

    return result as RecordFile;
  }

  private async findFileByQuery(q: string): Promise<RecordFile | undefined> {
    let { result } = await gapi.client.drive.files.list({
      corpora: 'user',
      fields: 'files(id, ownedByMe, permissions, sharingUser)',
      pageSize: 1,
      q
    });

    return result.files?.[0] as RecordFile | undefined;
  }

  private async listFiles(q: string, pageToken?: string): Promise<RecordFile[]> {
    let { result } = await gapi.client.drive.files.list({
      corpora: 'user',
      fields: 'nextPageToken, files(id, ownedByMe, permissions, sharingUser)',
      pageSize: 1000,
      pageToken,
      q
    });

    let files = result.files as RecordFile[] || [];

    if (result.nextPageToken) {
      return [...files, ...await this.listFiles(q, result.nextPageToken)];
    } else {
      return files;
    }
  }

  private async deleteFile(fileId: string): Promise<void> {
    await gapi.client.drive.files.update({ fileId, resource: { trashed: true } });
  }

  private async findSpreadsheet(id: string): Promise<Spreadsheet> {
    let { result: spreadsheet } = await gapi.client.sheets.spreadsheets.get({
      spreadsheetId: id,
      includeGridData: true,
    });

    return spreadsheet;
  }

  private async createSpreadsheet(resource: CreateSpreadsheet): Promise<Spreadsheet> {
    let { result: { spreadsheetId } } = await gapi.client.sheets.spreadsheets.create({
      fields: 'spreadsheetId',
      resource
    });

    assert('spreadsheetId missing', spreadsheetId);

    // The returned spreadsheet does not include the grid data
    return this.findSpreadsheet(spreadsheetId);
  }

  private async updateSpreadsheet({ spreadsheetId, requests }: UpdateSpreadsheet): Promise<Spreadsheet> {
    let { result } = await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests,
        includeSpreadsheetInResponse: true,
        responseIncludeGridData: true
      }
    });

    return result.updatedSpreadsheet!;
  }
}
