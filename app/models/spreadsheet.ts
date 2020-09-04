import Model, { attr } from '@ember-data/model';

export default class Spreadsheet extends Model {
  @attr() spreadsheet?: gapi.client.sheets.Spreadsheet;
}

declare module 'ember-data/types/registries/model' {
  export default interface ModelRegistry {
    'spreadsheet': Spreadsheet;
  }
}
