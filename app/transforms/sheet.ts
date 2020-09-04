import Transform from '@ember-data/serializer/transform';
import { attr } from '@ember-data/model';

import { assert, runInDebug } from '@ember/debug';

export interface ColumnTypes {
  date: Date;
  number: number;
  string: string;
}

export type ColumnOption = [
  title: string,
  type: keyof ColumnTypes
];

export interface SheetTransformOptions {
  columns: ColumnOption[];
}

export const sheet = (...columns: ColumnOption[]) =>
  attr('sheet', { columns } as SheetTransformOptions as any);

type RowData = gapi.client.sheets.RowData;
type CellData = gapi.client.sheets.CellData;

// Number of days between Lotus Epoch (Dec 30, 1899) and Unix Epoch
const DAYS_DELTA = 25569;
const DAY = 24 * 60 * 60 * 1000;

function dateFromSerialNumber(serial?: number): Date | undefined {
  if (serial === undefined) {
    return;
  } else {
    return new Date((serial - DAYS_DELTA) * DAY);
  }
}

function serialNumberFromDate(date?: Date): number | undefined {
  if (date === undefined) {
    return;
  } else {
    return (date.valueOf() / DAY) + DAYS_DELTA;
  }
}

export default class SheetTransform extends Transform {
  deserialize(serialized: RowData[] | undefined, _options: {}): ReadonlyArray<ReadonlyArray<unknown>> | undefined {
    if (!serialized) {
      return;
    }

    let { columns } = _options as SheetTransformOptions;

    assert('Missing columns in options', columns);
    assert('Missing header row', serialized.length >= 1);

    let [header, ...rows] = serialized;

    runInDebug(() => {
      assert(
        `Invalid header row, expecting ${columns.length} columns, got ${header.values?.length}`,
        columns.length === header.values?.length
      );

      for (let [i, cell] of header.values.entries()) {
        let expected = columns[i][0];
        let actual = cell.effectiveValue?.stringValue;

        assert(
          `Invalid header column ${i}, expecting ${expected}, got ${actual}`,
          expected === actual
        );
      }
    });

    return Object.freeze(
      rows
        .map((row, i) => {
          // assert does not work with ?.
          assert(`Unexpected empty row ${i}`, row.values && row.values.length);

          assert(
            `Too many columns on row ${i}, expecting up to ${columns.length}, got ${row.values.length}`,
            columns.length >= row.values.length
          );

          return this.deserializeRow(columns, row);
        })
    );
  }

  serialize(deserialized: ReadonlyArray<ReadonlyArray<unknown>> | undefined, _options: {}): RowData[] | undefined {
    if (!deserialized) {
      return;
    }

    let { columns } = _options as SheetTransformOptions;

    assert('Missing columns in options', columns);

    let header: RowData = {
      values: columns.map(([title]) => ({
        userEnteredValue: {
          stringValue: title
        },
        userEnteredFormat: {
          textFormat: {
            bold: true
          }
        }
      }))
    };

    let rows: RowData[] = deserialized.map((row, i) => {
      assert(`Unexpected empty row ${i}`, row.length);

      assert(
        `Too many columns on row ${i}, expecting up to ${columns.length}, got ${row.length}`,
        columns.length >= row.length
      );

      return this.serializeRow(columns, row);
    });

    return [header, ...rows];
  }

  private deserializeRow(columns: ColumnOption[], row: RowData): ReadonlyArray<unknown> {
    assert(`Unexpected empty row`, row.values);
    assert(
      `Incorrect row size, expecting up to ${columns.length}, got ${row.values.length}`,
      columns.length >= row.values.length
    );
    return Object.freeze(row.values.map((cell, i) => this.deserializeCell(columns[i][1], cell)));
  }

  private deserializeCell(type: keyof ColumnTypes, cell: CellData): unknown {
    switch (type) {
      case 'date':
        return dateFromSerialNumber(cell.effectiveValue?.numberValue);
      case 'number':
        return cell.effectiveValue?.numberValue;
      case 'string':
        return cell.effectiveValue?.stringValue;
      default:
        assert(`Unexpected column type ${type}`);
    }
  }

  private serializeRow(columns: ColumnOption[], row: ReadonlyArray<unknown>): RowData {
    assert(
      `Incorrect row size, expecting up to ${columns.length}, got ${row.length}`,
      columns.length >= row.length
    );
    return { values: row.map((value, i) => this.serializeCell(columns[i][1], value)) };
  }

  private serializeCell(type: keyof ColumnTypes, value: unknown): CellData {
    if (value === undefined) {
      return { userEnteredValue: {} };
    }

    switch (type) {
      case 'date':
        return {
          userEnteredValue: {
            numberValue: serialNumberFromDate(value as Date)
          },
          userEnteredFormat: {
            numberFormat: {
              type: 'DATE'
            }
          }
        };
      case 'number':
        assert(`Expecting number, got ${value}`, typeof value === 'number');
        return {
          userEnteredValue: {
            numberValue: value
          },
          userEnteredFormat: {
            numberFormat: {
              type: 'NUMBER'
            }
          }
        };
      case 'string':
        assert(`Expecting string, got ${value}`, typeof value === 'string');
        return {
          userEnteredValue: {
            stringValue: value
          }
        };
      default:
        assert(`Unexpected column type ${type}`);
    }
  }
}

declare module 'ember-data/types/registries/transform' {
  export default interface TransformRegistry {
    'sheet': SheetTransform;
  }
}
