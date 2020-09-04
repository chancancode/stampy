import Adapter from '@ember-data/adapter';
import Store from '@ember-data/store';
import DS from 'ember-data';
import ModelRegistry from 'ember-data/types/registries/model';
import { assert } from '@ember/debug';
import RSVP from 'rsvp';

import { CreateSpreadsheet, UpdateSpreadsheet } from 'stamps/serializers/application';

type File = gapi.client.drive.File;
type Spreadsheet = gapi.client.sheets.Spreadsheet;

export default class ApplicationAdapter extends Adapter {
  findRecord<K extends keyof ModelRegistry>(
    _store: Store,
    _type: ModelRegistry[K],
    id: string,
    _snapshot: DS.Snapshot<K>
  ): RSVP.Promise<Spreadsheet> {
    return RSVP.resolve(this.findSpreadsheetById(id));
  }

  findAll<K extends keyof ModelRegistry>(
    _store: Store,
    _type: ModelRegistry[K],
    _sinceToken: string,
    _snapshotRecordArray: DS.SnapshotRecordArray<K>
  ): RSVP.Promise<Spreadsheet[]> {
    return RSVP.resolve(this.findSpreadsheetsByQuery());
  }

  query<K extends keyof ModelRegistry>(
    _store: Store,
    _type: ModelRegistry[K],
    query: string,
    _recordArray: DS.AdapterPopulatedRecordArray<any>
  ): RSVP.Promise<Spreadsheet[]> {
    return RSVP.resolve(this.findSpreadsheetsByQuery(query));
  }

  queryRecord<K extends keyof ModelRegistry>(
    _store: Store,
    _type: ModelRegistry[K],
    query: string
  ): RSVP.Promise<Spreadsheet | undefined> {
    return RSVP.resolve(this.findSpreadsheetByQuery(query));
  }

  createRecord<K extends keyof ModelRegistry>(
    _store: Store,
    _type: ModelRegistry[K],
    snapshot: DS.Snapshot<K>
  ): RSVP.Promise<Spreadsheet> {
    let serialized = this.serialize(snapshot, { mode: 'create' }) as CreateSpreadsheet;
    return RSVP.resolve(this.createSpreadsheet(serialized));
  }

  updateRecord<K extends keyof ModelRegistry>(
    _store: Store,
    _type: ModelRegistry[K],
    snapshot: DS.Snapshot<K>
  ): RSVP.Promise<Spreadsheet> {
    let serialized = this.serialize(snapshot, { mode: 'update' }) as UpdateSpreadsheet;

    if (serialized.requests.length) {
      return RSVP.resolve(this.updateSpreadsheet(serialized));
    } else {
      return RSVP.resolve(this.findSpreadsheetById(serialized.spreadsheetId));
    }
  }

  deleteRecord<K extends keyof ModelRegistry>(
    _store: Store,
    _type: ModelRegistry[K],
    snapshot: DS.Snapshot<K>
  ): RSVP.Promise<void> {
    return RSVP.resolve(this.deleteFile(snapshot.id));
  }

  private async findSpreadsheetById(id: string): Promise<Spreadsheet> {
    let { result } = await gapi.client.sheets.spreadsheets.get({
      spreadsheetId: id,
      includeGridData: true,
    });

    return result;
  }

  private async findSpreadsheetByQuery(query: string): Promise<Spreadsheet | undefined> {
    let file = await this.findFile(query);

    if (file?.id) {
      return this.findSpreadsheetById(file.id);
    } else {
      return undefined;
    }
  }

  private async findSpreadsheetsByQuery(query?: string): Promise<Spreadsheet[]> {
    let files = await this.listFiles(query);

    return Promise.all(files.map(file => this.findSpreadsheetById(file.id!)));
  }

  private async createSpreadsheet(resource: CreateSpreadsheet): Promise<Spreadsheet> {
    let { result } = await gapi.client.sheets.spreadsheets.create({ resource });

    assert('spreadsheetId missing', result.spreadsheetId);

    // The returned spreadsheet does not include the grid data
    return this.findSpreadsheetById(result.spreadsheetId);
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

  private async findFile(query?: string): Promise<File | undefined> {
    let { result } = await gapi.client.drive.files.list({
      corpora: 'user',
      fields: 'files(id)',
      pageSize: 1,
      q: this.buildQuery(query)
    });

    return result.files?.[0];
  }

  private async listFiles(query?: string, pageToken?: string): Promise<File[]> {
    let { result } = await gapi.client.drive.files.list({
      corpora: 'user',
      fields: 'nextPageToken, files(id)',
      pageSize: 1000,
      pageToken,
      q: this.buildQuery(query)
    });

    let files = result.files || [];

    if (result.nextPageToken) {
      return [...files, ...await this.listFiles(query, result.nextPageToken)];
    } else {
      return files;
    }
  }

  private async deleteFile(fileId: string): Promise<void> {
    await gapi.client.drive.files.delete({ fileId });
  }

  private buildQuery(query?: string): string {
    let q = "appProperties has { key='-type' and value='stamp-card' } and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false";

    if (query) {
      q = `${q} and (${query})`;
    }

    return q;
  }
}
