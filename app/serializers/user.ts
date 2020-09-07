import Serializer from '@ember-data/serializer';
import Store from '@ember-data/store';
import Model from '@ember-data/model';
import ModelRegistry from 'ember-data/types/registries/model';
import DS from 'ember-data';

import { assert } from '@ember/debug';

import { UserWithLinks, Link } from 'stampy/adapters/user';

interface NormalizedRecord {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships: Record<string, {
    data: Link[]
  }>;
}

export default class UserSerializer extends Serializer {
  normalizeResponse(
    _store: Store,
    _primaryModelClass: Model,
    { gifted, received, ...user }: UserWithLinks,
    _id: string,
    requestType: string
  ): { data: NormalizedRecord } {
    assert(
      `Request type ${requestType} is not supported`,
      requestType === 'findRecord' || requestType === 'queryRecord'
    );

    let attributes: Record<string, unknown> = { ...user };

    return {
      data: {
        type: 'user',
        id: user.email,
        attributes,
        relationships: {
          gifted: {
            data: gifted
          },
          received: {
            data: received
          }
        }
      }
    };
  }

  serialize<K extends keyof ModelRegistry>(
    _snapshot: DS.Snapshot<K>,
    _options: {}
  ): never {
    assert('serialize is not supported');
  }
}
