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

interface NormalizedRecord {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
}

export default class SpreadsheetSerializer extends Serializer {
  normalizeResponse(
    store: Store,
    primaryModelClass: Model,
    payload: Spreadsheet,
    id: string,
    requestType: string
  ): { data: NormalizedRecord };
  normalizeResponse(
    store: Store,
    primaryModelClass: Model,
    payload: Spreadsheet[],
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
    payload: Spreadsheet | Spreadsheet[] | undefined,
    _id: string,
    _requestType: string
  ): { data: NormalizedRecord | NormalizedRecord[] } {
    if (Array.isArray(payload)) {
      return { data: payload.map(p => this.normalizeRecord(store, p)) };
    } else if (payload) {
      return { data: this.normalizeRecord(store, payload) };
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

  private normalizeRecord(store: Store, payload: Spreadsheet): NormalizedRecord {
    assert('id missing from payload', payload.spreadsheetId);

    let id = payload.spreadsheetId;

    assert('developerMetadata missing from payload', payload.developerMetadata);

    let type: keyof ModelRegistry | undefined;
    let attributes: Record<string, unknown> = Object.create(null);

    for (let metadata of payload.developerMetadata) {
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

    attributes['spreadsheet'] = payload;

    assert('-type key missing in metadata', type);

    // https://github.com/typed-ember/ember-cli-typescript/issues/1296
    let model = store.modelFor(type) as unknown as typeof Model;

    model.eachTransformedAttribute((name, type) => {
      if (type === 'sheet') {
        attributes[name] = this.deserializeRowData(this.findSheet(payload, name));
      }
    });

    this.applyTransforms(model, attributes, 'deserialize');

    return { id, type, attributes };
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
        let data = attributes[name][1];

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
}

declare module 'ember-data/types/registries/serializer' {
  export default interface SerializerRegistry {
    'spreadsheet': SpreadsheetSerializer;
  }
}
