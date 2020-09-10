import Serializer from '@ember-data/serializer';
import Transform from '@ember-data/serializer/transform';
import Store from '@ember-data/store';
import Model from '@ember-data/model';
import ModelRegistry from 'ember-data/types/registries/model';
import TransformRegistry from 'ember-data/types/registries/transform';
import DS from 'ember-data';

import { getOwner } from '@ember/application';
import { assert } from '@ember/debug';
import { get } from '@ember/object';
import { inject as service } from '@ember/service';

import SessionService from 'stampy/services/session';
import { AdapterRecord as AdapterRecord } from 'stampy/adapters/application';

type Spreadsheet = gapi.client.sheets.Spreadsheet;
type Properties = gapi.client.sheets.SpreadsheetProperties;
type Metadata = gapi.client.sheets.DeveloperMetadata;
type Sheet = gapi.client.sheets.Sheet;
type RowData = gapi.client.sheets.RowData;
type Request = gapi.client.sheets.Request;

export type CreateSpreadsheet = Pick<Spreadsheet,
  'developerMetadata' | 'properties' | 'sheets'
>;

export interface UpdateSpreadsheet {
  spreadsheetId: string;
  requests: Request[];
}

export interface SerializeOptions {
  mode: 'create' | 'update';
}

interface Link {
  type: keyof ModelRegistry;
  id: string;
}

interface User {
  name: string;
  email: string;
  picture?: string;
}

interface NormalizedRecord {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, {
    data: Link
  }>;
}

export default class ApplicationSerializer extends Serializer {
  @service declare session: SessionService;

  normalizeResponse(
    store: Store,
    primaryModelClass: Model,
    payload: AdapterRecord,
    id: string,
    requestType: string
  ): { data: NormalizedRecord };
  normalizeResponse(
    store: Store,
    primaryModelClass: Model,
    payload: AdapterRecord[],
    id: string,
    requestType: string
  ): { data: NormalizedRecord[] };
  normalizeResponse(
    store: Store,
    primaryModelClass: Model,
    payload: undefined,
    id: string,
    requestType: string
  ): { data: [] };
  normalizeResponse(
    store: Store,
    _primaryModelClass: Model,
    payload: AdapterRecord | AdapterRecord[] | undefined,
    _id: string,
    _requestType: string
  ): { data: NormalizedRecord | NormalizedRecord[], included?: NormalizedRecord[] } {
    if (Array.isArray(payload)) {
      let data = payload.map(p => this.normalizeRecord(store, p));
      let included = this.extractIncluded(payload);
      return { data, included };
    } else if (payload) {
      let data = this.normalizeRecord(store, payload);
      let included = this.extractIncluded([payload]);
      return { data, included };
    } else {
      return { data: [] };
    }
  }

  serialize<K extends keyof ModelRegistry>(
    snapshot: DS.Snapshot<K>,
    options: { mode: 'create' }
  ): CreateSpreadsheet;
  serialize<K extends keyof ModelRegistry>(
    snapshot: DS.Snapshot<K>,
    options: { mode: 'update' }
  ): UpdateSpreadsheet;
  serialize<K extends keyof ModelRegistry>(
    snapshot: DS.Snapshot<K>,
    options: SerializeOptions
  ): CreateSpreadsheet | UpdateSpreadsheet {
    if (options.mode === 'create') {
      return this.serializeForCreate(snapshot);
    } else {
      return this.serializeForUpdate(snapshot);
    }
  }

  private normalizeRecord(store: Store, { file, spreadsheet }: AdapterRecord): NormalizedRecord {
    assert('id missing from payload', spreadsheet.spreadsheetId);

    let id = spreadsheet.spreadsheetId;

    assert('developerMetadata missing from payload', spreadsheet.developerMetadata);

    let type: keyof ModelRegistry | undefined;
    let attributes: Record<string, unknown> = Object.create(null);

    for (let metadata of spreadsheet.developerMetadata) {
      let { location, visibility, metadataKey, metadataValue } = metadata;

      if (location?.locationType !== 'SPREADSHEET' || visibility !== 'PROJECT') {
        console.log(`Ignoring foreign metadata ${metadataKey}`, metadata);
        continue;
      }

      assert('metadataKey missing from payload', metadataKey);

      if (metadataValue === undefined) {
        continue;
      }

      assert('metadataValue missing from payload', typeof metadataValue === 'string');

      let parsedValue = JSON.parse(metadataValue);

      if (metadataKey === '-type') {
        assert('duplicate -type key in metadata', type === undefined);
        assert(`invalid -type ${parsedValue}`, parsedValue === 'stamp-card');
        type = parsedValue;
      } else {
        assert(`duplicate ${metadataKey} key in metadata`, !(metadataKey in metadata));
        attributes[metadataKey] = parsedValue;
      }
    }

    attributes['spreadsheet'] = spreadsheet;

    assert('-type key missing in metadata', type);

    // https://github.com/typed-ember/ember-cli-typescript/issues/1296
    let model = store.modelFor(type) as unknown as typeof Model;

    model.eachTransformedAttribute((name, type) => {
      if (type === 'sheet') {
        attributes[name] = this.deserializeRowData(this.findSheet(spreadsheet, name));
      }
    });

    this.applyTransforms(model, attributes, 'deserialize');

    let from: Link;
    let to: Link;

    if (file.ownedByMe) {
      from = {
        type: 'user',
        id: this.currentUser.email
      };

      let recipient = file.permissions.find(p =>
        p.emailAddress !== this.currentUser.email
      );

      assert('Missing permission in File', recipient);
      assert('Missing emailAddress in Permission', recipient.emailAddress);

      to = {
        type: 'user',
        id: recipient.emailAddress
      };
    } else {
      assert('Missing emailAddress in sharingUser', file.sharingUser.emailAddress);

      from = {
        type: 'user',
        id: file.sharingUser.emailAddress
      };

      to = {
        type: 'user',
        id: this.currentUser.email
      };
    }

    return {
      type,
      id,
      attributes,
      relationships: {
        from: { data: from },
        to: { data: to }
      }
    };
  }

  private extractIncluded(payload: AdapterRecord[]): NormalizedRecord[] {
    let users: Record<string, User> = {};

    let currentUserEmail = this.currentUser.email;

    users[currentUserEmail] = this.currentUser;

    for (let { file } of payload) {
      if (file.ownedByMe) {
        for (let { displayName, emailAddress, photoLink } of file.permissions) {
          if (emailAddress !== currentUserEmail) {
            assert('Missing displayName in Permission', displayName);
            assert('Missing emailAddress in Permission', emailAddress);

            users[emailAddress] = {
              name: displayName,
              email: emailAddress,
              picture: photoLink
            };
          }
        }
      } else {
        let { displayName, emailAddress, photoLink } = file.sharingUser;

        assert('Missing displayName in User', displayName);
        assert('Missing emailAddress in User', emailAddress);

        users[emailAddress] = {
          name: displayName,
          email: emailAddress,
          picture: photoLink
        };
      }
    }

    return Object.values(users).map(user => ({
      type: 'user',
      id: user.email,
      attributes: user as unknown as Record<string, unknown>
    }));
  }

  private applyTransforms<ModelClass extends typeof Model>(
    model: ModelClass,
    attributes: Record<string, unknown>,
    mode: 'serialize' | 'deserialize'
  ): void;
  private applyTransforms<ModelClass extends typeof Model>(
    model: ModelClass,
    attributes: Record<string, [unknown, unknown]>,
    mode: 'serialize-changed'
  ): void;
  private applyTransforms<ModelClass extends typeof Model>(
    model: ModelClass,
    attributes: Record<string, unknown>,
    mode: 'serialize' | 'serialize-changed' | 'deserialize'
  ): void {
    let meta = get(model, 'attributes');

    model.eachTransformedAttribute((key, transformType) => {
      let k = key as string;
      let transform = this.transformFor(transformType);
      let { options } = meta.get(k);

      if (k in attributes) {
        let value = attributes[k];

        if (mode === 'serialize-changed') {
          assert('Wrong attribute type', Array.isArray(value));
          value[1] = transform.serialize(value[1], options);
        } else {
          attributes[k] = transform[mode](value, options);
        }
      }
    });
  }

  private transformFor(type: keyof TransformRegistry): Transform {
    let transform = getOwner(this).lookup(`transform:${type}`);
    assert(`Unable to find the transform for \`attr('${type}')\``, transform);
    return transform;
  }

  private serializeForCreate<K extends keyof ModelRegistry>(
    snapshot: DS.Snapshot<K>
  ): CreateSpreadsheet {
    assert('cannot call serializeForCreate on existing records', snapshot.record.isNew);

    let sheets: Sheet[] = [];
    let developerMetadata: Metadata[] = [];

    // https://github.com/typed-ember/ember-cli-typescript/issues/1296
    let model = snapshot.type as unknown as typeof Model;
    let attributes: Record<string, unknown> = snapshot.attributes();

    delete attributes.spreadsheet;

    this.applyTransforms(model, attributes, 'serialize');

    model.eachTransformedAttribute((name, type) => {
      if (type === 'sheet') {
        if (name in attributes) {
          let data = attributes[name];

          if (Array.isArray(data)) {
            sheets.push(this.serializeSheet(name, data));
          }

          delete attributes[name];
        }
      }
    });

    for (let [key, value] of Object.entries(attributes)) {
      developerMetadata.push(this.serializeMetadata(key, value));
    }

    developerMetadata.push(this.serializeMetadata('-type', snapshot.modelName));

    let properties: Properties = {};

    if (typeof attributes['title'] === 'string') {
      properties.title = attributes['title'];
    }

    return { properties, developerMetadata, sheets };
  }

  private serializeForUpdate<K extends keyof ModelRegistry>(
    snapshot: DS.Snapshot<K>
  ): UpdateSpreadsheet {
    let requests: Request[] = [];

    let spreadsheet: Spreadsheet = snapshot.attr('spreadsheet' as any);
    assert('missing spreadsheet attribute', spreadsheet);

    let model = snapshot.type as unknown as typeof Model;
    let attributes = snapshot.changedAttributes() as unknown as Record<string, [unknown, unknown]>;

    assert('spreadsheet is readonly', !('spreadsheet' in attributes));
    delete attributes.spreadsheet;

    this.applyTransforms(model, attributes, 'serialize-changed');

    model.eachTransformedAttribute((name, type) => {
      if (type === 'sheet') {
        let data = attributes[name]?.[1];

        if (Array.isArray(data)) {
          requests.push(...this.serializeSheetUpdate(spreadsheet, name, data));
        }

        delete attributes[name];
      }
    });

    for (let [key, [, value]] of Object.entries(attributes)) {
      requests.push(this.serializeMetadataUpdate(spreadsheet, key, value));
    }

    return {
      spreadsheetId: snapshot.id,
      requests
    };
  }

  private serializeMetadata(key: string, value: unknown): Metadata {
    return {
      metadataKey: key,
      metadataValue: JSON.stringify(value),
      location: { spreadsheet: true },
      visibility: 'PROJECT'
    };
  }

  private serializeMetadataUpdate(spreadsheet: Spreadsheet, key: string, value: unknown): Request {
    let metadata = this.findMetadata(spreadsheet, key);

    if (metadata) {
      assert('Missing metadataId', typeof metadata.metadataId === 'number');

      return {
        updateDeveloperMetadata: {
          dataFilters: [{
            developerMetadataLookup: {
              metadataId: metadata.metadataId
            }
          }],
          developerMetadata: this.serializeMetadata(key, value),
          fields: '*'
        }
      };
    } else {
      return {
        createDeveloperMetadata: {
          developerMetadata: this.serializeMetadata(key, value)
        }
      };
    }
  }

  private serializeSheet(title: string, data: RowData[], id = Math.floor(Math.random() * 65536)): Sheet {
    return {
      data: [{
        startRow: 0,
        startColumn: 0,
        rowData: data
      }],
      protectedRanges: [{
        warningOnly: true,
        range: {
          sheetId: id,
          startRowIndex: 0,
          startColumnIndex: 0
        }
      }],
      properties: {
        sheetId: id,
        sheetType: 'GRID',
        title,
        gridProperties: {
          rowCount: data.length,
          frozenRowCount: 1,
          columnCount: this.countColumns(data)
        }
      }
    };
  }

  private serializeSheetUpdate(spreadsheet: Spreadsheet, title: string, data: RowData[]): Request[] {
    let sheet = this.findSheet(spreadsheet, title);

    if (sheet) {
      let sheetId = sheet.properties?.sheetId;

      assert('Missing sheetId', sheetId);

      return [
        {
          updateSheetProperties: {
            fields: '*',
            properties: this.serializeSheet(title, data, sheetId).properties
          }
        },
        this.serializeCellsUpdate(sheetId, data)
      ];
    } else {
      let sheet = this.serializeSheet(title, data);
      let sheetId = sheet.properties!.sheetId!;

      return [
        { addSheet: { properties: sheet.properties! } },
        this.serializeCellsUpdate(sheetId, data),
        { addProtectedRange: { protectedRange: sheet.protectedRanges![0] } }
      ];
    }
  }

  private serializeCellsUpdate(sheetId: number, data: RowData[]): Request {
    return {
      updateCells: {
        fields: '*',
        rows: data,
        range: {
          sheetId: sheetId,
          startRowIndex: 0,
          startColumnIndex: 0
        }
      }
    }
  }

  private findMetadata(spreadsheet: Spreadsheet, key: string): Metadata | undefined {
    return spreadsheet.developerMetadata?.find(metadata =>
      metadata.metadataKey === key &&
      metadata.location?.spreadsheet &&
      metadata.visibility === 'PROJECT'
    );
  }

  private findSheet(spreadsheet: Spreadsheet, title: string): Sheet | undefined {
    return spreadsheet.sheets?.find(sheet => sheet.properties?.title === title);
  }

  private deserializeRowData(sheet?: Sheet): RowData[] | undefined{
    if (!sheet || !sheet.data || !sheet.data.length) {
      return;
    }

    let title = sheet.properties?.title;
    let [data, ...extra] = sheet.data;

    assert(`Got extra ${extra.length} grid data in sheet ${title}`, extra.length === 0);
    assert(`Data startRow is ${data.startRow} in sheet ${title}`, !data.startRow);
    assert(`Data startColumn is ${data.startColumn} in sheet ${title}`, !data.startColumn);

    return data.rowData;
  }

  private countColumns(rows: RowData[]): number {
    return Math.max(...rows.map(row => row.values?.length || 0));
  }

  private get currentUser(): User {
    let { profile } = this.session;
    assert('not logged in', profile);

    let name = profile.getName();
    let email = profile.getEmail();
    let picture = profile.getImageUrl();

    return { name, email, picture };
  }
}
